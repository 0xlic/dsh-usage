# dsh-usage

在 DSH 输入框底栏原有轮数、Token、上下文统计之后追加所选模型的账户用量，点击查看详情。不替换原有统计，不修改模型、推理档位或计费身份。

## 独立查询

- **Codex**：按 `@lichen/dsh-codex-subscribe` 注册的 `codex-sub-<账号 ID>` 提供商确定账号；Host 独立请求 `https://chatgpt.com/backend-api/wham/usage`，不再调用或依赖 [WSL043/dsh-codex-subscription](https://github.com/WSL043/dsh-codex-subscription) 的 RPC、缓存、活动账号或刷新通知。上游协议与模型额度池匹配参考其 [usage.js](https://github.com/WSL043/dsh-codex-subscription/blob/main/src/usage.js)。通过公开 pi-ai OAuth 生命周期和 DSH credential record 锁刷新凭据；令牌不发送到浏览器。按具体模型匹配独立额度池（包括 Spark），显示剩余百分比和重置时间，窗口时长以服务端为准。
- **DeepSeek 账户**：Host 调用 DSH 内置 `deepseekAccount.getBalance()`，按币种精确合计充值与赠金；详情分列两种钱包和合计。API Key 提供商 `deepseek-official` 不使用已登录账户的钱包，因此不显示账户余额。
- **Capinfo**：读取现有 Capinfo 配置和密钥引用，由 Host 独立请求官方 `/v1/user/balance`，不读取 `capinfoBalance` 缓存，不使用原插件的私有余额桥接或演示余额。仅允许官方 HTTPS 域名，不接受浏览器指定上游地址。显示人民币余额、总额度、已用额度；无限额度为 `¥∞`。未配置、失败、无效或过期时统一显示 `¥--`，不展示缓存旧金额或错误原因。

原插件的“全局活动账号”和账号预览/对勾启用 UI 已移除。Codex 账号随模型提供商选择，切换账号应在宿主模型选择器或 Codex subscriptions 设置中进行。

## 缓存与刷新

三类用量共用 Host 缓存抽象：

- 按提供商/账号及凭据指纹隔离成功缓存，默认 TTL 60 秒；只存放公开的余额/额度投影，不持久化令牌。
- 并发请求合并；强制刷新绕过成功缓存，但不会绕过在途请求去重、失败退避和上游限流。
- 失败默认退避 5 秒，Codex `Retry-After` 最长退避 5 分钟；失败不伪装成成功的旧额度。
- 每次读取重新核对凭据身份，凭据替换、账号删除或请求晚到时不返回其他身份的数据。
- 插件卸载时停止请求与定时器，清空内存缓存。

客户端按提供商/模型共享订阅和刷新循环，不因多个会话组件挂载而各自启动轮询：

1. 初次显示或切换提供商/模型后立即刷新。
2. 成功选定模型后刷新，**再次选中同一个模型**或改变推理档位也刷新；选择失败不触发。
3. 显示期间每 60 秒刷新，页面隐藏时停止计时，回到前台或窗口重新获得焦点时刷新。
4. 点击用量打开详情后，标题旁的 **↻** 可手动刷新，刷新中按钮禁用。
5. 最后一个订阅卸载后停止客户端轮询，晚到响应不能恢复已失效的显示。

Host 查询统一走经过 Connection 认证的 `POST /api/plugins/usage/read` 接口，浏览器不能读取密钥。模型变化不会把别的账号或模型的客户端投影复用到新模型上。到达额度重置时仅显示“等待重置”，直到服务端返回新数据，不自行伪造补充后的百分比。

## 展示

使用 `conversation.composer.dock` 的独立 `dsh-usage` 条目（order 20），继承宿主字体、语言和主题。底栏保持单行，最多占 40% 宽度，窄窗口自动省略。点击余额/额度查看详情；点击外部、再次点击、关闭按钮或 Escape 关闭。

详情通过宿主 React DOM Portal 挂载到 `document.body`，避开 DSH 输入框容器的裁剪，优先向上展开并避让视口边缘，支持键盘焦点与缩放。日期跟随浏览器时区，Codex 更新时间来自本次实际上游查询的 `fetchedAt`，不将缓存读取时间当作数据源更新时间。

示例（仅为格式说明）：

```text
[原有会话统计]  5h 83% ↻ 4h59m 7day 61% ↻ 6d9h
[原有会话统计]  ¥68.28
```

## 安装与开发

```sh
git clone https://github.com/0xlic/dsh-usage.git
cd dsh-usage
npm install
npm run check
```

在 DSH 插件管理器添加克隆目录的绝对路径，或调用 `plugin_manager install_bundle`。不需要启动额外服务器。更新后的 Host 模块是否立即生效，以插件管理器的 `application`/重启提示为准，不能假定仅修改磁盘就会热更新。

运行时适配 DSH `0.2.2-rc.1`、`@lichen/dsh-codex-subscribe` 的 credential record v1/v2、pi-ai `1.3.0` 及当前 Capinfo 官方余额响应。依赖变更不代表安装原 WSL Codex 插件；pi-ai 仅用于公开 OAuth 刷新生命周期。

编辑 `client.source.js` / `logic.js` 后执行 `npm run build` 生成 `client.js`。Host 实现在 `index.js`、`host-cache.js`、`host-codex.js`、`host-capinfo.js`、`host-deepseek.js`。没有凭据时各适配器独立降级，不影响其他用量。

测试覆盖模型额度池、提供商隔离、同模型重新选择、缓存 TTL/强制刷新/去重/失败退避、凭据变化和晚到响应、余额精确合计、刷新计时及卸载清理。自动化通过不等于真实上游/视觉验证通过；安装后仍应在 GUI 中切换各提供商并点击刷新确认。

图标为本项目原创 SVG，许可证 MIT。
