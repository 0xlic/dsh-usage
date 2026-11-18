# dsh-usage

在 DSH 输入框底栏原有轮数、Token、上下文统计之后追加所选模型的账户用量，点击查看详情。不替换原有统计，不修改模型、推理档位或计费身份。

## 独立查询

- **Codex**：按 `@lichen/dsh-codex-subscribe` 注册的 `codex-sub-<账号 ID>` 提供商确定账号；Host 独立请求 `https://chatgpt.com/backend-api/wham/usage`，不再调用或依赖 [WSL043/dsh-codex-subscription](https://github.com/WSL043/dsh-codex-subscription) 的 RPC、缓存、活动账号或刷新通知。上游协议与模型额度池匹配参考其 [usage.js](https://github.com/WSL043/dsh-codex-subscription/blob/main/src/usage.js)。通过公开 pi-ai OAuth 生命周期和 DSH credential record 锁刷新凭据；令牌不发送到浏览器。按具体模型匹配独立额度池（包括 Spark），显示剩余百分比和重置时间，窗口时长以服务端为准。
- **DeepSeek 账户**：Host 调用 DSH 内置 `deepseekAccount.getBalance()`，按币种精确合计充值与赠金；详情分列两种钱包和合计。
- **DeepSeek API**：`deepseek-official` 使用当前路由的 API Key，由 Host 请求[官方余额接口](https://api-docs.deepseek.com/zh-cn/api/get-user-balance.md) `GET https://api.deepseek.com/user/balance`。复用账户余额的底栏和详情样式，显示总余额、充值余额、未过期赠金和查询时间；支持 CNY / USD，缺失或无效金额字段不展示，真实的零余额正常显示。余额属于该 Key 对应的账户，不是 Key 独立额度，也不借用 DSH 登录账号的钱包。跟随提供商设置目录中的 `apiKeyEnv`（默认 `DEEPSEEK_API_KEY`）及 `baseURL` / 启动环境 `DEEPSEEK_BASE_URL`；自定义非官方地址不查询官方余额，密钥只由 Host 解析且禁止跟随重定向。公开 API 未提供历史消费、累计 Token、限额或重置时间查询，因此不展示这些指标，不用余额差值推算消费。
- **Kimi Coding**：选择 `kimi-coding` 提供商时，Host 使用该路由的 `apiKeyEnv`（默认 `KIMI_API_KEY`）请求 `GET https://api.kimi.com/coding/v1/usages`，支持官方 `api.kimi.ai` 国际端点。沿 DSH 提供商目录读取嵌套配置，复用已有密钥，无需额外输入。底栏显示服务端返回的窗口剩余百分比和重置倒计时，详情显示完整窗口、重置时间和查询时间；紧凑模式隐藏底栏的 7 天窗口，但保留详情。`usage` 按 7 天限额展示，不称为月度/总额度；暂不展示加油包、月度消费或 Token 统计。仅查询官方 `/coding`、`/coding/v1` 路由，代理/自定义地址不发送密钥、不查询官方用量；密钥不传到浏览器，禁止重定向。该接口未有稳定公开协议保证，字段依据 [Kimi 用量响应资料](https://github.com/PowerUserZ/OpenTokenUsage/blob/main/docs/providers/kimi.md) 实现，需使用真实 API Key 验证。
- **Capinfo**：不请求 Capinfo 余额接口，直接读取 `@local/dsh-capinfo` 通过 Cordis 暴露的只读 `capinfoUsage` 服务（`today()`），展示该插件统计的今日费用和今日 Token。底栏只显示金额与 Token，以 `·` 分隔，Token 使用 `K` / `M` / `B` 英文简写（如 `¥0.12 · 5.9M`）；详情面板使用同一快照，以原始今日费用 ÷ 今日 Token × 1,000,000 计算每百万 Token 的平均单位成本，不为此新增请求；Token 为零或费用缺失时显示 `--`。打开面板时仍会再读取一次快照。服务未启用、尚未采样或首次读取失败时显示占位符，不展示错误原文。

Codex 账号随当前模型提供商选择。详情里预览其他 Codex 账号不会改变当前账号，只有确认切换才会更新模型提供商。

## Codex 重置卡

Codex 用量详情会查询上方账号可用的一次性限额重置卡，按到期时间排列。每张卡显示两行：名称，以及过期时间和「使用」文字操作。重置卡不是付费余额；点击「使用」后还需确认，随后只使用选中的卡，并刷新该账号的限额和卡片列表。预览其他账号时只能查看，切换到该账号后才能使用。查询失败与没有可用卡分别提示，不会自动消耗卡。

Host 复用 Codex OAuth，调用 [Codex 客户端使用的重置卡接口](https://github.com/openai/codex/blob/main/codex-rs/backend-client/src/client/rate_limit_resets.rs)。请求结果不确定时先更新列表，用户重试同一张卡时复用原请求 ID。

## 缓存与刷新

各类用量共用 Host 缓存抽象：

- 按提供商/账号及凭据指纹隔离成功缓存，默认 TTL 60 秒；只存放公开的余额/额度投影，不持久化令牌。Capinfo 直接读取 dsh-capinfo 的内存快照，不经过 Host 缓存或上游请求。
- 并发请求合并；强制刷新绕过成功缓存，但不会绕过在途请求去重、失败退避和上游限流。
- 失败默认退避 5 秒，Codex `Retry-After` 最长退避 5 分钟；失败不伪装成成功的旧额度。
- 每次读取重新核对凭据身份，凭据替换、账号删除或请求晚到时不返回其他身份的数据。
- 插件卸载时停止请求与定时器，清空内存缓存。

客户端按提供商/模型共享订阅和刷新循环，不因多个会话组件挂载而各自启动轮询：

1. 初次显示或切换提供商/模型后立即刷新。
2. 成功选定模型后刷新，**再次选中同一个模型**或改变推理档位也刷新；选择失败不触发。
3. 显示期间每 60 秒刷新，页面隐藏时停止计时，回到前台或窗口重新获得焦点时刷新。所有提供商的后台刷新失败时，继续显示同一路由上次成功取得的数据和原更新时间，不显示刷新错误，下次照常重试。已确认的凭据身份变化不会沿用旧数据。
4. 点击用量打开详情后，标题旁的 **↻** 可手动刷新，刷新中按钮禁用。
5. 最后一个订阅卸载后停止客户端轮询，晚到响应不能恢复已失效的显示。

Host 查询统一走经过 Connection 认证的 `POST /api/plugins/usage/read` 接口，浏览器不能读取密钥。模型变化不会把别的账号或模型的客户端投影复用到新模型上。到达额度重置时仅显示“等待重置”，直到服务端返回新数据，不自行伪造补充后的百分比。

## 展示

使用 `conversation.composer.dock` 的独立 `dsh-usage` 条目（order 20），继承宿主字体、语言和主题。底栏保持单行，最多占 40% 宽度，窄窗口自动省略。点击金额、Token 或额度查看详情；详情面板与底栏共用同一份数据，Capinfo 打开面板时会重新读取 dsh-capinfo 的实时快照。点击外部、再次点击、关闭按钮或 Escape 关闭。

详情通过宿主 React DOM Portal 挂载到 `document.body`，避开 DSH 输入框容器的裁剪，优先向上展开并避让视口边缘，支持键盘焦点与缩放。日期跟随浏览器时区，Codex 更新时间来自本次实际上游查询的 `fetchedAt`，不将缓存读取时间当作数据源更新时间。

示例（仅为格式说明）：

```text
[原有会话统计]  5h 83% ↻ 4h59m 7day 61% ↻ 6d9h
[原有会话统计]  ¥0.12 · 5.9M
```

## 安装与开发

```sh
git clone https://github.com/0xlic/dsh-usage.git
cd dsh-usage
npm install
npm run check
```

在 DSH 插件管理器添加克隆目录的绝对路径，或调用 `plugin_manager install_bundle`。不需要启动额外服务器。更新后的 Host 模块是否立即生效，以插件管理器的 `application`/重启提示为准，不能假定仅修改磁盘就会热更新。

运行时适配 DSH `0.2.2-rc.1` / `0.2.2-rc.2`、`@lichen/dsh-codex-subscribe` 的 credential record v1/v2、pi-ai `1.3.0` 及 `@local/dsh-capinfo` 的 `capinfoUsage.today()` 服务。依赖变更不代表安装原 WSL Codex 插件；pi-ai 仅用于公开 OAuth 刷新生命周期。

编辑 `client.source.js` / `logic.js` 后执行 `npm run build` 生成 `client.js`。Host 实现在 `index.js`、`host-cache.js`、`host-codex.js`、`host-capinfo.js`、`host-deepseek.js`、`host-deepseek-api.js`、`host-kimi.js`。没有凭据或依赖服务时各适配器独立降级，不影响其他用量。

测试覆盖模型额度池、提供商隔离、同模型重新选择、缓存 TTL/强制刷新/去重/失败退避、凭据变化和晚到响应、余额精确合计、Capinfo 今日数据投影、刷新计时及卸载清理。自动化通过不等于真实上游/视觉验证通过；安装后仍应在 GUI 中切换各提供商并点击刷新确认。

图标为本项目原创 SVG，许可证 MIT。
