import type { ValidationError } from 'class-validator';

const FIELD_LABELS: Record<string, string> = {
  category: '资料类型',
  memberId: '归属成员',
  files: '文件',
  titles: '标题列表',
  page: '页码',
  pageSize: '每页数量',
  username: '用户名',
  password: '密码',
  currentPassword: '当前密码',
  newPassword: '新密码',
  familyId: '家族',
  role: '角色',
  status: '状态',
  gender: '性别',
  lifeStatus: '生命状态',
  relationType: '亲属关系',
  eventType: '事件类型',
  reviewAction: '审核操作',
  sourceType: '来源类型',
  source: '来源说明',
  title: '标题',
  description: '描述',
  tags: '标签',
};

function labelOf(property: string) {
  return FIELD_LABELS[property] ?? property;
}

function translateConstraint(property: string, constraint: string) {
  const label = labelOf(property);
  const normalized = constraint.toLowerCase();

  if (normalized.includes('must be one of the following values')) {
    return `${label}的取值不合法。`;
  }

  if (normalized.includes('must be a string')) {
    return `${label}必须是文本。`;
  }

  if (normalized.includes('should not be empty')) {
    return `请填写${label}。`;
  }

  if (normalized.includes('must be an integer number')) {
    return `${label}必须是整数。`;
  }

  if (normalized.includes('must not be less than')) {
    const minValue = constraint.match(/\d+/)?.[0];
    return minValue ? `${label}不能小于 ${minValue}。` : `${label}不能小于允许的最小值。`;
  }

  if (normalized.includes('must not be greater than')) {
    const maxValue = constraint.match(/\d+/)?.[0];
    return maxValue ? `${label}不能大于 ${maxValue}。` : `${label}不能大于允许的最大值。`;
  }

  if (normalized.includes('must be longer than or equal to')) {
    const minValue = constraint.match(/\d+/)?.[0];
    return minValue ? `${label}至少需要 ${minValue} 个字符。` : `${label}长度太短。`;
  }

  if (normalized.includes('must be shorter than or equal to')) {
    const maxValue = constraint.match(/\d+/)?.[0];
    return maxValue ? `${label}最多允许 ${maxValue} 个字符。` : `${label}长度太长。`;
  }

  if (normalized.includes('must be an array')) {
    return `${label}必须是列表。`;
  }

  if (normalized.includes('must contain no more than')) {
    const maxValue = constraint.match(/\d+/)?.[0];
    return maxValue ? `${label}最多允许 ${maxValue} 项。` : `${label}项目过多。`;
  }

  if (normalized.includes('must be a valid iso 8601 date string')) {
    return `${label}必须是合法日期。`;
  }

  if (normalized.includes('must be a boolean value')) {
    return `${label}必须是布尔值。`;
  }

  return `${label}校验未通过。`;
}

export function formatValidationErrors(errors: ValidationError[]) {
  const messages: string[] = [];

  const visit = (error: ValidationError) => {
    if (error.constraints) {
      for (const constraint of Object.values(error.constraints)) {
        messages.push(translateConstraint(error.property, constraint));
      }
    }

    error.children?.forEach(visit);
  };

  errors.forEach(visit);

  return messages.length > 0 ? messages : ['请求参数不正确，请检查后重试。'];
}
