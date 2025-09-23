import { useDialog } from "../ui/dialog"
import { DialogModel } from "./dialog-model"
import { DialogSelect, type DialogSelectOption } from "../ui/dialog-select"
import { useRoute } from "../context/route"
import { DialogSessionList } from "./dialog-session-list"
import { DialogAgent } from "./dialog-agent"
import {
  createContext,
  createMemo,
  createSignal,
  onCleanup,
  useContext,
  type Accessor,
  type ParentProps,
} from "solid-js"
import { useKeyboard } from "@opentui/solid"

type Context = ReturnType<typeof init>
const ctx = createContext<Context>()

function init() {
  const [registrations, setRegistrations] = createSignal<Accessor<DialogSelectOption[]>[]>([])
  const options = createMemo(() => {
    return registrations().flatMap((x) => x())
  })

  return {
    register(cb: () => DialogSelectOption[]) {
      const results = createMemo(cb)
      setRegistrations((x) => [...x, results])
      onCleanup(() => {
        setRegistrations((x) => x.filter((x) => x !== results))
      })
    },
    get options() {
      return options()
    },
  }
}

export function useCommandDialog() {
  const value = useContext(ctx)
  if (!value) {
    throw new Error("useCommandDialog must be used within a CommandProvider")
  }
  return value
}

export function CommandProvider(props: ParentProps) {
  const value = init()
  const dialog = useDialog()

  useKeyboard((evt) => {
    if (evt.name === "k" && evt.ctrl) {
      dialog.replace(() => <DialogCommand options={value.options} />)
      return
    }
  })

  return <ctx.Provider value={value}>{props.children}</ctx.Provider>
}

function DialogCommand(props: { options: DialogSelectOption[] }) {
  return <DialogSelect title="Commands" options={props.options} />
}
