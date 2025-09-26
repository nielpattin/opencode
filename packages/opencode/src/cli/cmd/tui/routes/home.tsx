import { Installation } from "@/installation"
import { useTheme } from "@tui/context/theme"
import { TextAttributes } from "@opentui/core"
import { Prompt } from "@tui/component/prompt"
import { For } from "solid-js"

export function Home() {
  const { currentTheme } = useTheme()
  const theme = currentTheme()

  return (
    <box flexGrow={1} justifyContent="center" alignItems="center">
      <box>
        <Logo theme={theme} />
        <box paddingTop={2}>
          <HelpRow slash="new" theme={theme}>
            new session
          </HelpRow>
          <HelpRow slash="help" theme={theme}>
            show help
          </HelpRow>
          <HelpRow slash="share" theme={theme}>
            share session
          </HelpRow>
          <HelpRow slash="models" theme={theme}>
            list models
          </HelpRow>
          <HelpRow slash="agents" theme={theme}>
            list agents
          </HelpRow>
        </box>
      </box>
      <box paddingTop={3} minWidth={75}>
        <Prompt />
      </box>
    </box>
  )
}

function HelpRow(props: { children: string; slash: string; theme: any }) {
  return (
    <text>
      <span style={{ bold: true, fg: props.theme.primary }}>/{props.slash.padEnd(10, " ")}</span>
      <span>{props.children.padEnd(19, " ")} </span>
      <span style={{ fg: props.theme.textMuted }}>ctrl+x n</span>
    </text>
  )
}

const LOGO_LEFT = [`                   `, `█▀▀█ █▀▀█ █▀▀█ █▀▀▄`, `█░░█ █░░█ █▀▀▀ █░░█`, `▀▀▀▀ █▀▀▀ ▀▀▀▀ ▀  ▀`]

const LOGO_RIGHT = [`             ▄     `, `█▀▀▀ █▀▀█ █▀▀█ █▀▀█`, `█░░░ █░░█ █░░█ █▀▀▀`, `▀▀▀▀ ▀▀▀▀ ▀▀▀▀ ▀▀▀▀`]

function Logo(props: { theme: any }) {
  return (
    <box>
      <For each={LOGO_LEFT}>
        {(line, index) => (
          <box flexDirection="row" gap={1}>
            <text fg={props.theme.textMuted}>{line}</text>
            <text fg={props.theme.text} attributes={TextAttributes.BOLD}>
              {LOGO_RIGHT[index()]}
            </text>
          </box>
        )}
      </For>
      <box flexDirection="row" justifyContent="flex-end">
        <text fg={props.theme.textMuted}>{Installation.VERSION}</text>
      </box>
    </box>
  )
}
