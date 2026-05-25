# 样式分层与维护约定

## 1. 分层结构

- `tokens.css`：仅定义设计 token（颜色、文本、阴影、功能色、字体）。
- `base.css`：仅放基础标签样式（`html`/`body`/`a`/`*`）。
- `layout-shell.css`：应用壳层（侧栏、头部、租户卡、公共内容区）。
- `shared-panels.css`：跨页面复用的卡片、筛选区、列表壳层。
- `feature-modules.css`：业务模块聚合入口，只做 `@import`。
  - `modules/graph.css`
  - `modules/kinship.css`
  - `modules/changelog.css`
  - `modules/member-detail.css`
  - `modules/asset-library.css`
  - `modules/utility-sections.css`
- `auth-pages.css`：认证页聚合入口，只做 `@import`。
  - `auth/login.css`
  - `auth/invite.css`
  - `auth/animations.css`
- `responsive.css`：响应式聚合入口，只做 `@import`。
  - `responsive/motion.css`
  - `responsive/lg.css`
  - `responsive/md.css`
  - `responsive/sm.css`

## 2. 归属边界

- 只在一个业务页面出现：放到对应 `modules/*.css` 或 `auth/*.css`。
- 两个以上页面复用：放到 `shared-panels.css`。
- 属于应用框架（头部、侧栏、内容容器）：放到 `layout-shell.css`。
- 颜色、阴影、字体、状态色：先加 token，再引用 token，不直接散落常量。

## 3. 命名规范

- 推荐命名：`domain-component`、`domain-component-state`。
- 禁止使用无语义短名（例如 `box1`、`card2`）。
- 与 Ant Design 的覆盖必须带业务前缀容器：
  - 推荐：`.member-detail-tabs .ant-tabs-nav`
  - 避免：直接覆盖 `.ant-tabs-nav`

## 4. 色彩策略

- 后台高频区默认使用中性色 token（`--neutral-*`、`--text-*`、`--panel-*`）。
- 半透明层与模块渐变统一复用 token（`--surface-alpha-*`、`--surface-cool-*`、`--*-blend-*`），避免在业务样式里直接写 `rgba(...)`。
- 品牌红色用于强调与识别，不作为大面积底色。
- 功能态统一使用语义 token：
  - 成功：`--success` / `--success-bg`
  - 信息：`--info` / `--info-bg`
  - 警告：`--warning` / `--warning-bg`
  - 危险：`--danger` / `--danger-bg`
- 登录页允许保留“谱牒文化”暖色主题，但建议局部使用，不外溢到后台模块。

## 5. 新增样式检查清单

- 是否先复用已有 token，而不是新写色值？
- 是否放在了正确归属文件？
- 是否会影响移动端（`responsive.css` 是否需要补充）？
- 是否存在全局选择器污染？
- 是否通过 `pnpm --filter @fisrtname/web lint` 与 `build` 验证？

## 6. 新页面接入模板

1. 先在页面目录内实现结构，优先复用已有 `shared-panels.css` 类名。
2. 页面独有样式放入对应模块文件：
`modules/<page-domain>.css` 或 `auth/<page-domain>.css`。
3. 在聚合入口追加 `@import`：
`feature-modules.css` 或 `auth-pages.css`。
4. 颜色、边框、阴影先补 token，再在模块中引用 token。
5. 响应式规则按断点写入：
`responsive/lg.css`、`responsive/md.css`、`responsive/sm.css`。
6. 完成后执行：
`pnpm --filter @fisrtname/web lint` 与 `pnpm --filter @fisrtname/web build`。
