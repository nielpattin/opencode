import { createStore } from "solid-js/store"
import { For, Match, Switch } from "solid-js"
import { useKeyboard } from "@opentui/solid"
import { useTheme } from "../../context/theme"
import type { PermissionRequest } from "@opencode-ai/sdk/v2"
import { useSDK } from "../../context/sdk"
import { SplitBorder } from "../../component/border"

export function PermissionPrompt(props: { request: PermissionRequest }) {
  const sdk = useSDK()
  const [store, setStore] = createStore({
    always: false,
  })

  return (
    <Switch>
      <Match when={store.always}>
        <Prompt
          title="Always allow"
          body={props.request.always.join("\n")}
          options={{ confirm: "Confirm", cancel: "Cancel" }}
          onSelect={(option) => {
            if (option === "cancel") {
              setStore("always", false)
              return
            }
            sdk.client.permission.reply({
              reply: "always",
              requestID: props.request.id,
            })
          }}
        />
      </Match>
      <Match when={!store.always}>
        <Prompt
          title="Permission required"
          body={props.request.message}
          options={{ once: "Allow once", always: "Allow always", reject: "Reject" }}
          onSelect={(option) => {
            if (option === "always") {
              setStore("always", true)
              return
            }
            sdk.client.permission.reply({
              reply: option as "once" | "reject",
              requestID: props.request.id,
            })
          }}
        />
      </Match>
    </Switch>
  )
}

function Prompt<const T extends Record<string, string>>(props: {
  title: string
  body: string
  options: T
  onSelect: (option: keyof T) => void
}) {
  const { theme } = useTheme()
  const keys = Object.keys(props.options) as (keyof T)[]
  const [store, setStore] = createStore({
    selected: keys[0],
  })

  useKeyboard((evt) => {
    if (evt.name === "left" || evt.name == "h") {
      evt.preventDefault()
      const idx = keys.indexOf(store.selected)
      const next = keys[(idx - 1 + keys.length) % keys.length]
      setStore("selected", next)
    }

    if (evt.name === "right" || evt.name == "l") {
      evt.preventDefault()
      const idx = keys.indexOf(store.selected)
      const next = keys[(idx + 1) % keys.length]
      setStore("selected", next)
    }

    if (evt.name === "return") {
      evt.preventDefault()
      props.onSelect(store.selected)
    }
  })

  return (
    <box
      backgroundColor={theme.backgroundPanel}
      border={["left"]}
      borderColor={theme.warning}
      customBorderChars={SplitBorder.customBorderChars}
    >
      <box gap={1} paddingLeft={2} paddingRight={3} paddingTop={1} paddingBottom={1}>
        <box flexDirection="row" gap={1}>
          <text fg={theme.warning}>{"△"}</text>
          <text fg={theme.text}>{props.title}</text>
        </box>
        <box flexDirection="row" gap={1}>
          <text fg={theme.textMuted} flexShrink={0}>
            {"→"}
          </text>
          <text fg={theme.textMuted}>{props.body}</text>
        </box>
      </box>
      <box
        flexDirection="row"
        gap={1}
        paddingLeft={2}
        paddingRight={3}
        paddingBottom={1}
        backgroundColor={theme.backgroundElement}
        justifyContent="space-between"
      >
        <box flexDirection="row" gap={1}>
          <For each={keys}>
            {(option) => (
              <box
                paddingLeft={1}
                paddingRight={1}
                backgroundColor={option === store.selected ? theme.warning : theme.backgroundMenu}
              >
                <text fg={option === store.selected ? theme.selectedListItemText : theme.textMuted}>
                  {props.options[option]}
                </text>
              </box>
            )}
          </For>
        </box>
        <box flexDirection="row" gap={2}>
          <text fg={theme.textMuted}>
            {"⇆"} <span style={{ fg: theme.text }}>select</span>
          </text>
          <text fg={theme.textMuted}>
            <span style={{ fg: theme.text }}>enter</span> confirm
          </text>
        </box>
      </box>
    </box>
  )
}
