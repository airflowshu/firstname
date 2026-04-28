'use client';

import { Select } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import type { MemberOption } from '@/lib/types';

function uniqueOptions(options: MemberOption[]) {
  const map = new Map<string, MemberOption>();
  options.forEach((option) => map.set(option.id, option));
  return Array.from(map.values());
}

function getNativePlaceFromSubtitle(subtitle?: string) {
  if (!subtitle) {
    return '';
  }

  const taggedNative = subtitle.match(/籍贯[:：]\s*([^·,，]+)/);
  if (taggedNative?.[1]) {
    return taggedNative[1].trim();
  }

  const parts = subtitle
    .split(/[·,，]/)
    .map((part) => part.trim())
    .filter(Boolean);

  const geoPart = parts.find((part) => /[省市县区州旗镇乡村]/.test(part));
  return geoPart ?? '';
}

function getBirthYearFromSubtitle(subtitle?: string) {
  if (!subtitle) {
    return '';
  }

  const yearMatch = subtitle.match(/((?:18|19|20)\d{2})\s*年?/);
  return yearMatch?.[1] ?? '';
}

function getBirthYearFromDate(date?: string | null) {
  if (!date) {
    return '';
  }

  const yearMatch = date.match(/^((?:18|19|20)\d{2})/);
  return yearMatch?.[1] ?? '';
}

export function RemoteMemberSelect({
  value,
  onChange,
  placeholder,
  disabledIds = [],
  seedOptions = [],
  allowClear = true,
  disabled = false,
}: {
  value?: string;
  onChange?: (value?: string) => void;
  placeholder?: string;
  disabledIds?: string[];
  seedOptions?: MemberOption[];
  allowClear?: boolean;
  disabled?: boolean;
}) {
  const [fetchedOptions, setFetchedOptions] = useState<MemberOption[]>([]);
  const [selectedFallback, setSelectedFallback] = useState<MemberOption | null>(null);
  const [fetching, setFetching] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const mergedOptions = useMemo(
    () =>
      uniqueOptions([...seedOptions, ...fetchedOptions, ...(selectedFallback ? [selectedFallback] : [])]),
    [fetchedOptions, seedOptions, selectedFallback],
  );

  const normalizedOptions = useMemo(
    () =>
      mergedOptions
        .filter((option) => !disabledIds.includes(option.id))
        .map((option) => {
          const nativePlace = getNativePlaceFromSubtitle(option.subtitle);
          const birthYear = getBirthYearFromSubtitle(option.subtitle);
          const displayLabel = [option.name, nativePlace, birthYear ? `${birthYear}年生` : '']
            .filter(Boolean)
            .join(' · ');

          return {
            value: option.id,
            displayLabel,
            label: (
              <div className="member-select-option-line" title={displayLabel}>
                <span className="member-select-option-name">{option.name}</span>
                {nativePlace ? (
                  <span className="member-select-option-native">· {nativePlace}</span>
                ) : null}
                {birthYear ? (
                  <span className="member-select-option-native">· {birthYear}年生</span>
                ) : null}
              </div>
            ),
          };
        }),
    [disabledIds, mergedOptions],
  );

  const loadOptions = async (keyword = '') => {
    setFetching(true);
    try {
      const result = await api.getMemberOptions(keyword);
      setFetchedOptions(result);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    if (!dropdownOpen) {
      return;
    }

    const timer = window.setTimeout(() => {
      void loadOptions(searchValue.trim());
    }, 250);

    return () => window.clearTimeout(timer);
  }, [dropdownOpen, searchValue]);

  useEffect(() => {
    if (!value) {
      setSelectedFallback(null);
      return;
    }

    if (mergedOptions.some((option) => option.id === value)) {
      return;
    }

    let active = true;
    const loadSelectedMember = async () => {
      try {
        const member = await api.getMember(value);
        if (!active) {
          return;
        }

        const subtitle = [
          member.generationName ? `代际：${member.generationName}` : null,
          member.nativePlace ? `籍贯：${member.nativePlace}` : null,
          getBirthYearFromDate(member.birthDate) ? `${getBirthYearFromDate(member.birthDate)}年生` : null,
        ]
          .filter(Boolean)
          .join(' · ');

        setSelectedFallback({
          id: member.id,
          name: member.name,
          gender: member.gender,
          subtitle: subtitle || '已选成员',
        });
      } catch {
        if (!active) {
          return;
        }

        setSelectedFallback({
          id: value,
          name: value,
          gender: 'UNKNOWN',
          subtitle: '成员信息加载失败',
        });
      }
    };

    void loadSelectedMember();

    return () => {
      active = false;
    };
  }, [mergedOptions, value]);

  return (
    <Select
      className="member-select"
      style={{ width: '100%' }}
      allowClear={allowClear}
      showSearch
      disabled={disabled}
      value={value}
      popupMatchSelectWidth={false}
      optionLabelProp="displayLabel"
      filterOption={false}
      placeholder={placeholder}
      styles={{ popup: { root: { minWidth: 300, maxWidth: 'calc(100vw - 24px)' } } }}
      notFoundContent={fetching ? '正在检索匹配成员…' : '暂无匹配成员'}
      options={normalizedOptions}
      onSearch={setSearchValue}
      onOpenChange={(open) => {
        setDropdownOpen(open);

        if (open && fetchedOptions.length === 0) {
          void loadOptions(searchValue.trim());
        }
      }}
      onClear={() => {
        setSearchValue('');
        setFetchedOptions([]);
        setSelectedFallback(null);
      }}
      onChange={(nextValue) => onChange?.(nextValue)}
    />
  );
}
