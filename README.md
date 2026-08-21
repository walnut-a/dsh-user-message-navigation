# DSH User Message Minimap（用户消息导航轨）

一款可随时安装和卸载的 DeepSeek Harness Web 插件。它会在长对话左侧显示紧凑的用户消息 Minimap，让你快速辨认当前轮次并跳回之前的指令。

> English: A removable Web client plugin that adds a compact user-message minimap to long DeepSeek Harness conversations.

当前版本为 `0.1.9`，面向 DeepSeek Harness `0.1.1-rc.2`。插件使用公开的 `shell.overlay` 插槽，但在 DSH 提供专用的对话导航接口前，仍需通过现有 Chat DOM 属性发现用户消息位置。

## 名称

- 对外名称：**DSH User Message Minimap**
- 中文名称：**用户消息导航轨**
- npm 包名：`dsh-user-message-navigation`

Minimap 是这个插件的简短别名，表示用一条缩略导航轨映射长对话中的用户消息位置。npm 包名保持不变，因此已有安装命令不受影响。

## 功能

- 对话中至少有 4 条用户消息时显示导航轨。
- 每条用户消息对应一个标记，顺序与对话内容一致。
- 点击标记或使用键盘，可跳转到对应的用户消息。
- 距离不超过 5 条消息时使用短距离平滑滚动；更远距离和拖动导航保持即时定位。
- 到达目标后使用当前 DSH 主题色突出消息，并尊重系统的“减少动效”设置。
- 拖动导航轨时可连续浏览长对话。

## 安装

将插件安装到 DSH Web profile，然后启动 Web 客户端：

```sh
dsh plugin --profile web add dsh-user-message-navigation
dsh web
```

如果使用的 profile 不是 `web`，请将命令中的 `web` 替换为实际名称。

## 卸载

```sh
dsh plugin --profile web remove dsh-user-message-navigation
```

卸载后重新启动 DSH，导航轨及其监听器不会继续保留。

## 使用方式

1. 打开一段至少包含 4 条用户消息的 Chat 对话。
2. 在对话左侧找到竖向的消息标记。
3. 悬停可查看对应消息的文本预览。
4. 点击标记即可定位；也可以沿导航轨拖动，连续浏览不同轮次。

## 本地开发

```sh
pnpm install
pnpm test
pnpm run build
dsh plugin --profile web add .
dsh web
```

## 发布包验证

```sh
pnpm run pack:check
pnpm pack
dsh plugin --profile web add ./dsh-user-message-navigation-0.1.9.tgz
```

## 兼容性边界

DSH 支持插件包和浏览器端动态加载机制，但当前 Chat 界面尚未提供稳定的“用户消息列表”和“滚动到消息”服务。这个版本会读取以下现有 DOM 属性：

- `data-chat-flow`
- `data-chat-flow-kind="user"`
- `data-chat-anchor-key`
- `data-conversation-scroll`

这些属性属于 DSH Web 的实现细节，不是稳定的第三方插件接口。升级 DSH 后如果导航轨不再显示或无法定位，请先停用插件并在 GitHub Issues 报告所用的 DSH 版本。未来获得上游插槽或服务后，插件应改用正式接口，再承诺跨 DSH 版本兼容。

## 支持与文档

- 产品需求：[用户消息导航轨插件 PRD](docs/用户消息导航轨插件-PRD.md)
- 问题反馈：[GitHub Issues](https://github.com/walnut-a/dsh-user-message-navigation/issues)
- 源代码：[GitHub Repository](https://github.com/walnut-a/dsh-user-message-navigation)
