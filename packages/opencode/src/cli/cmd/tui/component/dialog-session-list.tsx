import { useDialog } from "@tui/ui/dialog"
import { DialogSelect } from "@tui/ui/dialog-select"
import { useRoute } from "@tui/context/route"
import { useSync } from "@tui/context/sync"
import { createMemo, onMount } from "solid-js"
import { Locale } from "@/util/locale"

export function DialogSessionList() {
  const dialog = useDialog()
  const sync = useSync()
  const route = useRoute()

  const options = createMemo(() => {
    const today = new Date().toDateString()
    return sync.data.session.map((x) => {
      const date = new Date(x.time.updated)
      let category = date.toDateString()
      if (category === today) {
        category = "Today"
      }
      return {
        title: x.title,
        value: x.id,
        category,
        footer: Locale.time(x.time.updated),
      }
    })
  })

  onMount(() => {
    dialog.setSize("large")
  })

  return (
    <DialogSelect
      title="Sessions"
      options={options()}
      limit={50}
      onSelect={(option) => {
        route.navigate({
          type: "session",
          sessionID: option.value,
        })
        dialog.clear()
      }}
    />
  )
}
