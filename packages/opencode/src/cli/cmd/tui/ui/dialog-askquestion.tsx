import { TextareaRenderable, ScrollBoxRenderable, TextAttributes, RGBA } from "@opentui/core"
import { useTheme, selectedForeground } from "@tui/context/theme"
import { useDialog } from "@tui/ui/dialog"
import { useKeybind } from "@tui/context/keybind"
import { useExit } from "@tui/context/exit"
import { batch, createEffect, createMemo, For, Show, on, type JSX } from "solid-js"
import { createStore, produce } from "solid-js/store"
import { useKeyboard, useTerminalDimensions } from "@opentui/solid"
import type { AskQuestion } from "@/askquestion"

export interface DialogAskQuestionProps {
  questions: AskQuestion.Question[]
  onSubmit: (answers: AskQuestion.Answer[]) => void
  onCancel: () => void
}

interface QuestionState {
  selectedOption: number
  selectedValues: string[]
  customText?: string
}

export function DialogAskQuestion(props: DialogAskQuestionProps) {
  const { theme } = useTheme()
  const dimensions = useTerminalDimensions()
  const fg = selectedForeground(theme)
  const dialog = useDialog()
  const keybind = useKeybind()
  const exit = useExit()

  // State for the wizard
  const [store, setStore] = createStore({
    activeTab: 0,
    questionStates: props.questions.map(() => ({
      selectedOption: 0,
      selectedValues: [] as string[],
      customText: undefined as string | undefined,
    })) as QuestionState[],
    isTypingCustom: false,
    customInputValue: "",
  })

  // Current question based on active tab
  const currentQuestion = createMemo(() => props.questions[store.activeTab])
  const currentState = createMemo(() => store.questionStates[store.activeTab])

  // Options including "Type something..." at the end
  const optionsWithCustom = createMemo(() => [
    ...currentQuestion().options,
    { value: "__custom__", label: "Type something.", description: "Enter your own response" },
  ])

  // Check if all questions have at least one answer
  const allAnswered = createMemo(() =>
    store.questionStates.every((state) => state.selectedValues.length > 0 || state.customText),
  )

  // Check if current question is answered
  const currentAnswered = createMemo(() => {
    const state = currentState()
    return state.selectedValues.length > 0 || state.customText
  })

  let scrollRef: ScrollBoxRenderable
  let inputRef: TextareaRenderable

  function scrollToSelected(optionIndex: number) {
    if (!scrollRef) return
    const target = scrollRef.getChildren().find((child) => child.id === `option-${optionIndex}`)
    if (!target) return
    const y = target.y - scrollRef.y
    if (y >= scrollRef.height) {
      scrollRef.scrollBy(y - scrollRef.height + target.height)
    }
    if (y < 0) {
      scrollRef.scrollBy(y)
    }
  }

  // Handle keyboard navigation
  useKeyboard((evt) => {
    if (evt.defaultPrevented || dialog.stack.length > 0) return

    if (keybind.match("app_exit", evt)) {
      props.onCancel()
      exit()
      return
    }

    if (store.isTypingCustom) {
      // In custom input mode
      if (evt.name === "escape") {
        setStore("isTypingCustom", false)
        setStore("customInputValue", "")
        return
      }
      if (evt.name === "return") {
        const value = store.customInputValue.trim()
        if (value) {
          setStore(
            produce((s) => {
              s.questionStates[s.activeTab].customText = value
              s.questionStates[s.activeTab].selectedValues = []
            }),
          )
        }
        setStore("isTypingCustom", false)
        setStore("customInputValue", "")
        // Auto-advance to next question or submit
        if (store.activeTab < props.questions.length - 1) {
          setStore("activeTab", store.activeTab + 1)
          return
        }
        if (allAnswered()) {
          handleSubmit()
        }
      }
      return
    }

    // Tab/arrow navigation between questions
    if (evt.name === "tab" || evt.name === "right") {
      if (store.activeTab < props.questions.length - 1) {
        setStore("activeTab", store.activeTab + 1)
        return
      }
      if (allAnswered()) {
        handleSubmit()
      }
      return
    }
    if (evt.shift && evt.name === "tab") {
      if (store.activeTab > 0) {
        setStore("activeTab", store.activeTab - 1)
      }
      return
    }
    if (evt.name === "left") {
      if (store.activeTab > 0) {
        setStore("activeTab", store.activeTab - 1)
      }
      return
    }

    // Up/down navigation within options
    if (evt.name === "up" || (evt.ctrl && evt.name === "p")) {
      const current = currentState().selectedOption
      const max = optionsWithCustom().length - 1
      const next = current > 0 ? current - 1 : max
      setStore(
        produce((s) => {
          s.questionStates[s.activeTab].selectedOption = next
        }),
      )
      scrollToSelected(next)
      return
    }
    if (evt.name === "down" || (evt.ctrl && evt.name === "n")) {
      const current = currentState().selectedOption
      const max = optionsWithCustom().length - 1
      const next = current < max ? current + 1 : 0
      setStore(
        produce((s) => {
          s.questionStates[s.activeTab].selectedOption = next
        }),
      )
      scrollToSelected(next)
      return
    }

    // Space to toggle selection (especially useful for multi-select)
    if (evt.name === "space") {
      const selectedIdx = currentState().selectedOption
      const option = optionsWithCustom()[selectedIdx]

      if (option.value === "__custom__") {
        // Open custom input
        setStore("isTypingCustom", true)
        setTimeout(() => inputRef?.focus(), 10)
        return
      }

      const question = currentQuestion()
      setStore(
        produce((s) => {
          const state = s.questionStates[s.activeTab]
          state.customText = undefined

          if (question.multiSelect) {
            // Toggle for multi-select
            const idx = state.selectedValues.indexOf(option.value)
            if (idx >= 0) {
              state.selectedValues.splice(idx, 1)
            } else {
              state.selectedValues.push(option.value)
            }
          } else {
            // Select for single-select (same as Enter)
            state.selectedValues = [option.value]
            if (s.activeTab < props.questions.length - 1) {
              s.activeTab++
            }
          }
        }),
      )
      // Auto-submit if single-select on last question
      if (!currentQuestion().multiSelect) {
        setTimeout(() => {
          if (allAnswered()) {
            handleSubmit()
          }
        }, 50)
      }
      return
    }

    // Enter to select option (single-select) or confirm and advance (multi-select)
    if (evt.name === "return") {
      const selectedIdx = currentState().selectedOption
      const option = optionsWithCustom()[selectedIdx]
      const question = currentQuestion()

      if (option.value === "__custom__") {
        // Open custom input
        setStore("isTypingCustom", true)
        setTimeout(() => inputRef?.focus(), 10)
        return
      }

      if (question.multiSelect) {
        // For multi-select: Enter confirms current selections and advances
        if (currentAnswered()) {
          if (store.activeTab < props.questions.length - 1) {
            setStore("activeTab", store.activeTab + 1)
            return
          }
          if (allAnswered()) {
            handleSubmit()
          }
          return
        }
        // If nothing selected yet, toggle the current option
        setStore(
          produce((s) => {
            const state = s.questionStates[s.activeTab]
            state.customText = undefined
            state.selectedValues.push(option.value)
          }),
        )
        return
      }

      // Single-select: select and advance
      setStore(
        produce((s) => {
          const state = s.questionStates[s.activeTab]
          state.customText = undefined
          state.selectedValues = [option.value]
          if (s.activeTab < props.questions.length - 1) {
            s.activeTab++
          }
        }),
      )
      // Auto-submit if this was the last question
      setTimeout(() => {
        if (allAnswered()) {
          handleSubmit()
        }
      }, 50)
      return
    }

    // Number keys for quick selection (1-8)
    if (evt.name >= "1" && evt.name <= "8") {
      const idx = parseInt(evt.name) - 1
      if (idx < currentQuestion().options.length) {
        const option = currentQuestion().options[idx]
        setStore(
          produce((s) => {
            const state = s.questionStates[s.activeTab]
            state.customText = undefined
            if (currentQuestion().multiSelect) {
              const existingIdx = state.selectedValues.indexOf(option.value)
              if (existingIdx >= 0) {
                state.selectedValues.splice(existingIdx, 1)
              } else {
                state.selectedValues.push(option.value)
              }
            } else {
              state.selectedValues = [option.value]
              if (s.activeTab < props.questions.length - 1) {
                s.activeTab++
              }
            }
          }),
        )
      }
      return
    }

    // Escape to cancel
    if (evt.name === "escape") {
      props.onCancel()
      return
    }

    // Ctrl+Enter to submit
    if (evt.ctrl && evt.name === "return") {
      if (allAnswered()) {
        handleSubmit()
      }
      return
    }
  })

  function handleSubmit() {
    const answers: AskQuestion.Answer[] = props.questions.map((q, i) => {
      const state = store.questionStates[i]
      return {
        questionId: q.id,
        values: state.selectedValues,
        customText: state.customText,
      }
    })
    props.onSubmit(answers)
  }

  const height = createMemo(() => {
    const options = optionsWithCustom()
    const selectedIdx = currentState().selectedOption
    const selectedOpt = options[selectedIdx]

    // Base height is 1 line per option
    let totalLines = options.length

    // Add space for the description ONLY if it's currently visible
    if (selectedOpt?.description && selectedOpt.value !== "__custom__") {
      // Most descriptions wrap to 2-3 lines
      totalLines += 2
    }

    return Math.min(totalLines, 15)
  })

  return (
    <box flexDirection="column">
      {/* Tab bar */}
      <box flexDirection="row" paddingLeft={2} paddingRight={2} gap={2} marginBottom={1}>
        <text fg={theme.textMuted}>←</text>
        <For each={props.questions}>
          {(question, index) => {
            const isActive = createMemo(() => store.activeTab === index())
            const isAnswered = createMemo(() => {
              const state = store.questionStates[index()]
              return state.selectedValues.length > 0 || state.customText
            })
            return (
              <box flexDirection="row" gap={1} paddingRight={1} onMouseUp={() => setStore("activeTab", index())}>
                <text fg={isAnswered() ? theme.success : theme.textMuted}>{isAnswered() ? "●" : "○"}</text>
                <text
                  fg={isActive() ? theme.text : theme.textMuted}
                  attributes={isActive() ? TextAttributes.BOLD : undefined}
                >
                  {question.label}
                </text>
              </box>
            )
          }}
        </For>
        <Show when={allAnswered()}>
          <box flexDirection="row" gap={1}>
            <text fg={theme.success}>✓</text>
            <text fg={theme.success} attributes={TextAttributes.BOLD} onMouseUp={handleSubmit}>
              Submit
            </text>
          </box>
        </Show>
        <text fg={theme.textMuted}>→</text>
      </box>

      {/* Current question */}
      <box paddingLeft={2} paddingRight={2} flexDirection="column" gap={0} marginBottom={1}>
        <text fg={theme.primary} attributes={TextAttributes.BOLD}>
          {currentQuestion().question}
        </text>
      </box>

      {/* Options */}
      <scrollbox
        ref={(r: ScrollBoxRenderable) => (scrollRef = r)}
        maxHeight={height()}
        paddingLeft={2}
        paddingRight={2}
        scrollX={false}
        scrollbarOptions={{ visible: true }}
        horizontalScrollbarOptions={{ visible: false }}
        marginBottom={1}
      >
        <For each={optionsWithCustom()}>
          {(option, index) => {
            const isSelected = createMemo(() => currentState().selectedOption === index())
            const isChosen = createMemo(() => {
              if (option.value === "__custom__") {
                return !!currentState().customText
              }
              return currentState().selectedValues.includes(option.value)
            })

            return (
              <box
                id={`option-${index()}`}
                flexDirection="column"
                backgroundColor={isSelected() ? theme.primary : RGBA.fromInts(0, 0, 0, 0)}
                paddingLeft={1}
                paddingRight={1}
                paddingTop={0}
                paddingBottom={0}
                onMouseUp={() => {
                  setStore(
                    produce((s) => {
                      s.questionStates[s.activeTab].selectedOption = index()
                    }),
                  )
                }}
              >
                <box flexDirection="row" gap={1}>
                  {/* Use different icons for single vs multi select */}
                  <text fg={isSelected() ? fg : theme.textMuted} flexShrink={0}>
                    {option.value === "__custom__"
                      ? "›"
                      : currentQuestion().multiSelect
                        ? isChosen()
                          ? "[✓]"
                          : "[ ]"
                        : isChosen()
                          ? "●"
                          : "○"}
                  </text>
                  <text
                    fg={isSelected() ? fg : isChosen() ? theme.success : theme.text}
                    attributes={isSelected() || isChosen() ? TextAttributes.BOLD : undefined}
                    wrapMode="word"
                  >
                    {option.label}
                  </text>
                </box>
                <Show when={option.description && option.value !== "__custom__" && isSelected()}>
                  <text fg={fg} wrapMode="word" paddingLeft={currentQuestion().multiSelect ? 5 : 3}>
                    {option.description}
                  </text>
                </Show>
              </box>
            )
          }}
        </For>
      </scrollbox>

      {/* Custom input (when active) */}
      <Show when={store.isTypingCustom}>
        <box paddingLeft={2} paddingRight={2} marginBottom={1}>
          <textarea
            ref={(r) => (inputRef = r)}
            height={1}
            wrapMode="none"
            placeholder="Type your response..."
            cursorColor={theme.primary}
            focusedTextColor={theme.text}
            focusedBackgroundColor={theme.backgroundPanel}
            onContentChange={() => {
              const text = inputRef?.plainText ?? ""
              // Strip newlines - this is a single-line input
              if (text.includes("\n")) {
                const clean = text.replace(/\n/g, "")
                inputRef?.setText(clean)
                inputRef?.gotoBufferEnd()
                setStore("customInputValue", clean)
              } else {
                setStore("customInputValue", text)
              }
            }}
          />
        </box>
      </Show>

      {/* Instructions */}
      <box paddingLeft={2} paddingRight={2}>
        <text fg={theme.textMuted}>
          {currentQuestion().multiSelect
            ? "Space to toggle · Enter to confirm · ↑↓ to navigate · Esc to cancel"
            : "Enter/Space to select · ↑↓ to navigate · Esc to cancel"}
        </text>
      </box>
    </box>
  )
}
