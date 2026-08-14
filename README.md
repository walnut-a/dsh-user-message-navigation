# DSH User Message Navigation

A removable Web client plugin that adds a compact user-message navigation rail to long DeepSeek Harness conversations.

Version `0.1.0` targets DeepSeek Harness `0.1.0-rc.6`. The current implementation uses the public `shell.overlay` slot, but temporarily discovers message anchors through Chat DOM attributes while a dedicated conversation navigation API is proposed upstream.

## Features

- Shows one compact marker for each user message in conversations with at least four user turns.
- Clicks and keyboard activation jump to the corresponding message.
- Jumps within five messages use a short smooth scroll; longer jumps and drag navigation remain immediate.
- Arrival feedback uses the active DSH theme and respects `prefers-reduced-motion`.

## Install

Install the published bundle into the Web profile, then start DSH:

```sh
dsh plugin --profile web add dsh-user-message-navigation
dsh web
```

Remove it with:

```sh
dsh plugin --profile web remove dsh-user-message-navigation
```

## Local development

```sh
pnpm install
pnpm test
pnpm run build
dsh plugin --profile web add .
dsh web
```

## Distribution check

```sh
pnpm run pack:check
pnpm pack
dsh plugin --profile web add ./dsh-user-message-navigation-0.1.0.tgz
```

## Compatibility boundary

The plugin package and dynamic browser loading mechanism are supported by DSH. The current Chat surface does not yet expose user-message navigation data or a scroll-to-message service, so the prototype reads these existing DOM attributes:

- `data-chat-flow`
- `data-chat-flow-kind="user"`
- `data-chat-anchor-key`
- `data-conversation-scroll`

They are implementation details rather than a stable third-party contract. A production release should move to an upstream slot/service before claiming compatibility across DSH releases.

## Documentation

The product requirements are tracked in [docs/用户消息导航轨插件-PRD.md](docs/用户消息导航轨插件-PRD.md).
