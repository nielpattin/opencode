/** @param {any} resp */
function fromOpenaiResponse(resp) {
  if (!resp || typeof resp !== "object") return resp
  if (Array.isArray(resp.choices)) return resp

  const r = resp.response ?? resp
  if (!r || typeof r !== "object") return resp

  const idIn = r.id
  const id =
    typeof idIn === "string" ? idIn.replace(/^resp_/, "chatcmpl_") : `chatcmpl_${Math.random().toString(36).slice(2)}`
  const model = r.model ?? resp.model

  const out = Array.isArray(r.output) ? r.output : []
  const text = out
    .filter((o) => o && o.type === "message" && Array.isArray(o.content))
    .flatMap((o) => o.content)
    .filter((p) => p && p.type === "output_text" && typeof p.text === "string")
    .map((p) => p.text)
    .join("")

  const tcs = out
    .filter((o) => o && o.type === "function_call")
    .map((o) => {
      const name = o.name
      const a = o.arguments
      const args = typeof a === "string" ? a : JSON.stringify(a ?? {})
      const tid = typeof o.id === "string" && o.id.length > 0 ? o.id : `toolu_${Math.random().toString(36).slice(2)}`
      return { id: tid, type: "function", function: { name, arguments: args } }
    })

  const finish = (r) => {
    if (r === "stop") return "stop"
    if (r === "tool_call" || r === "tool_calls") return "tool_calls"
    if (r === "length" || r === "max_output_tokens") return "length"
    if (r === "content_filter") return "content_filter"
    return null
  }

  const u = r.usage ?? resp.usage
  const usage = (() => {
    if (!u) return undefined
    const pt = typeof u.input_tokens === "number" ? u.input_tokens : undefined
    const ct = typeof u.output_tokens === "number" ? u.output_tokens : undefined
    const total = pt != null && ct != null ? pt + ct : undefined
    const cached = u.input_tokens_details?.cached_tokens
    const details = typeof cached === "number" ? { cached_tokens: cached } : undefined
    return {
      prompt_tokens: pt,
      completion_tokens: ct,
      total_tokens: total,
      ...(details ? { prompt_tokens_details: details } : {}),
    }
  })()

  return {
    id,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          ...(text && text.length > 0 ? { content: text } : {}),
          ...(tcs.length > 0 ? { tool_calls: tcs } : {}),
        },
        finish_reason: finish(r.stop_reason ?? null),
      },
    ],
    ...(usage ? { usage } : {}),
  }
}

/** @param {string} chunk */
function fromOpenaiChunk(chunk) {
  const lines = chunk.split("\n")
  const ev = lines[0]
  const dl = lines[1]
  if (!ev || !dl || !dl.startsWith("data: ")) return chunk

  let json
  try {
    json = JSON.parse(dl.slice(6))
  } catch {
    return chunk
  }

  const respObj = json.response ?? {}

  const out: any = {
    id: respObj.id ?? json.id ?? "",
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model: respObj.model ?? json.model ?? "",
    choices: [],
  }

  const e = ev.replace("event: ", "").trim()

  if (e === "response.output_text.delta") {
    const d = json.delta ?? json.text ?? json.output_text_delta
    if (typeof d === "string" && d.length > 0)
      out.choices.push({ index: 0, delta: { content: d }, finish_reason: null })
  }

  if (e === "response.output_item.added" && json.item?.type === "function_call") {
    const name = json.item?.name
    const id = json.item?.id
    if (typeof name === "string" && name.length > 0) {
      out.choices.push({
        index: 0,
        delta: {
          tool_calls: [{ index: 0, id, type: "function", function: { name, arguments: "" } }],
        },
        finish_reason: null,
      })
    }
  }

  if (e === "response.function_call_arguments.delta") {
    const a = json.delta ?? json.arguments_delta
    if (typeof a === "string" && a.length > 0) {
      out.choices.push({
        index: 0,
        delta: { tool_calls: [{ index: 0, function: { arguments: a } }] },
        finish_reason: null,
      })
    }
  }

  if (e === "response.completed") {
    const fr = (() => {
      const sr = respObj.stop_reason ?? json.stop_reason
      if (sr === "stop") return "stop"
      if (sr === "tool_call" || sr === "tool_calls") return "tool_calls"
      if (sr === "length" || sr === "max_output_tokens") return "length"
      if (sr === "content_filter") return "content_filter"
      return null
    })()
    out.choices.push({ index: 0, delta: {}, finish_reason: fr })

    const u = respObj.usage ?? json.response?.usage
    if (u) {
      out.usage = {
        prompt_tokens: u.input_tokens,
        completion_tokens: u.output_tokens,
        total_tokens: (u.input_tokens || 0) + (u.output_tokens || 0),
        ...(u.input_tokens_details?.cached_tokens
          ? { prompt_tokens_details: { cached_tokens: u.input_tokens_details.cached_tokens } }
          : {}),
      }
    }
  }

  return out
}

/**
 * @type {import('@opencode-ai/plugin').Plugin}
 */
export async function CopilotAuthPlugin({ client }) {
  const CLIENT_ID = "Iv1.b507a08c87ecfe98"
  const HEADERS = {
    "User-Agent": "GitHubCopilotChat/0.32.4",
    "Editor-Version": "vscode/1.105.1",
    "Editor-Plugin-Version": "copilot-chat/0.32.4",
    "Copilot-Integration-Id": "vscode-chat",
  }
  const RESPONSES_API_ALTERNATE_INPUT_TYPES = [
    "file_search_call",
    "computer_call",
    "computer_call_output",
    "web_search_call",
    "function_call",
    "function_call_output",
    "image_generation_call",
    "code_interpreter_call",
    "local_shell_call",
    "local_shell_call_output",
    "mcp_list_tools",
    "mcp_approval_request",
    "mcp_approval_response",
    "mcp_call",
    "reasoning",
  ]

  function normalizeDomain(url) {
    return url.replace(/^https?:\/\//, "").replace(/\/$/, "")
  }

  function getUrls(domain) {
    return {
      DEVICE_CODE_URL: `https://${domain}/login/device/code`,
      ACCESS_TOKEN_URL: `https://${domain}/login/oauth/access_token`,
      COPILOT_API_KEY_URL: `https://api.${domain}/copilot_internal/v2/token`,
    }
  }

  return {
    auth: {
      provider: "github-copilot",
      loader: async (getAuth, provider) => {
        let info = await getAuth()
        if (!info || info.type !== "oauth") return {}

        if (provider && provider.models) {
          for (const model of Object.values(provider.models)) {
            model.cost = {
              input: 0,
              output: 0,
            }
          }
        }

        // Set baseURL based on deployment type
        const enterpriseUrl = info.enterpriseUrl
        const baseURL = enterpriseUrl
          ? `https://copilot-api.${normalizeDomain(enterpriseUrl)}`
          : "https://api.githubcopilot.com"

        return {
          baseURL,
          apiKey: "",
          async fetch(input, init) {
            const info = await getAuth()
            if (info.type !== "oauth") return {}
            if (!info.access || info.expires < Date.now()) {
              const domain = info.enterpriseUrl ? normalizeDomain(info.enterpriseUrl) : "github.com"
              const urls = getUrls(domain)

              const response = await fetch(urls.COPILOT_API_KEY_URL, {
                headers: {
                  Accept: "application/json",
                  Authorization: `Bearer ${info.refresh}`,
                  ...HEADERS,
                },
              })

              if (!response.ok) return

              const tokenData = await response.json()

              const saveProviderID = info.enterpriseUrl ? "github-copilot-enterprise" : "github-copilot"
              await client.auth.set({
                path: {
                  id: saveProviderID,
                },
                body: {
                  type: "oauth",
                  refresh: info.refresh,
                  access: tokenData.token,
                  expires: tokenData.expires_at * 1000,
                  ...(info.enterpriseUrl && {
                    enterpriseUrl: info.enterpriseUrl,
                  }),
                },
              })
              info.access = tokenData.token
            }
            let isAgentCall = false
            let isVisionRequest = false
            try {
              const body = typeof init.body === "string" ? JSON.parse(init.body) : init.body
              if (body?.messages) {
                isAgentCall = body.messages.some((msg) => msg.role && ["tool", "assistant"].includes(msg.role))
                isVisionRequest = body.messages.some(
                  (msg) => Array.isArray(msg.content) && msg.content.some((part) => part.type === "image_url"),
                )
              }

              if (body?.input) {
                const lastInput = body.input[body.input.length - 1]

                const isAssistant = lastInput?.role === "assistant"
                const hasAgentType = lastInput?.type
                  ? RESPONSES_API_ALTERNATE_INPUT_TYPES.includes(lastInput.type)
                  : false
                isAgentCall = isAssistant || hasAgentType

                isVisionRequest =
                  Array.isArray(lastInput?.content) && lastInput.content.some((part) => part.type === "input_image")
              }
            } catch {}
            const headers = {
              ...init.headers,
              ...HEADERS,
              Authorization: `Bearer ${info.access}`,
              "Openai-Intent": "conversation-edits",
              "X-Initiator": isAgentCall ? "agent" : "user",
            }
            if (isVisionRequest) {
              headers["Copilot-Vision-Request"] = "true"
            }

            delete headers["x-api-key"]
            delete headers["authorization"]

            const url = typeof input === "string" ? input : input.url
            const isResponsesApi = url.endsWith("/responses")

            const response = await fetch(input, {
              ...init,
              headers,
            })

            if (!isResponsesApi) return response

            // Parse Responses API format
            const isStream = response.headers.get("content-type")?.includes("text/event-stream")

            if (!isStream) {
              const json = await response.json()
              const converted = fromOpenaiResponse(json)
              return new Response(JSON.stringify(converted), {
                status: response.status,
                statusText: response.statusText,
                headers: response.headers,
              })
            }

            // Handle streaming response
            const stream = new ReadableStream({
              async start(controller) {
                const reader = response.body?.getReader()
                if (!reader) {
                  controller.close()
                  return
                }

                const decoder = new TextDecoder()
                const encoder = new TextEncoder()
                let buffer = ""

                while (true) {
                  const { done, value } = await reader.read()
                  if (done) {
                    controller.close()
                    return
                  }

                  buffer += decoder.decode(value, { stream: true })
                  const parts = buffer.split("\n\n")
                  buffer = parts.pop() ?? ""

                  for (const part of parts) {
                    const trimmed = part.trim()
                    if (!trimmed) continue

                    const converted = fromOpenaiChunk(trimmed)
                    if (typeof converted === "string") {
                      controller.enqueue(encoder.encode(converted + "\n\n"))
                    } else {
                      controller.enqueue(encoder.encode("data: " + JSON.stringify(converted) + "\n\n"))
                    }
                  }
                }
              },
            })

            return new Response(stream, {
              status: response.status,
              statusText: response.statusText,
              headers: response.headers,
            })
          },
        }
      },
      methods: [
        {
          type: "oauth",
          label: "Login with GitHub Copilot",
          prompts: [
            {
              type: "select",
              key: "deploymentType",
              message: "Select GitHub deployment type",
              options: [
                {
                  label: "GitHub.com",
                  value: "github.com",
                  hint: "Public",
                },
                {
                  label: "GitHub Enterprise",
                  value: "enterprise",
                  hint: "Data residency or self-hosted",
                },
              ],
            },
            {
              type: "text",
              key: "enterpriseUrl",
              message: "Enter your GitHub Enterprise URL or domain",
              placeholder: "company.ghe.com or https://company.ghe.com",
              condition: (inputs) => inputs.deploymentType === "enterprise",
              validate: (value) => {
                if (!value) return "URL or domain is required"
                try {
                  const url = value.includes("://") ? new URL(value) : new URL(`https://${value}`)
                  if (!url.hostname) return "Please enter a valid URL or domain"
                  return undefined
                } catch {
                  return "Please enter a valid URL (e.g., company.ghe.com or https://company.ghe.com)"
                }
              },
            },
          ],
          async authorize(inputs = {}) {
            const deploymentType = inputs.deploymentType || "github.com"

            let domain = "github.com"
            let actualProvider = "github-copilot"

            if (deploymentType === "enterprise") {
              const enterpriseUrl = inputs.enterpriseUrl
              domain = normalizeDomain(enterpriseUrl)
              actualProvider = "github-copilot-enterprise"
            }

            const urls = getUrls(domain)

            const deviceResponse = await fetch(urls.DEVICE_CODE_URL, {
              method: "POST",
              headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                "User-Agent": "GitHubCopilotChat/0.35.0",
              },
              body: JSON.stringify({
                client_id: CLIENT_ID,
                scope: "read:user",
              }),
            })

            if (!deviceResponse.ok) {
              throw new Error("Failed to initiate device authorization")
            }

            const deviceData = await deviceResponse.json()

            return {
              url: deviceData.verification_uri,
              instructions: `Enter code: ${deviceData.user_code}`,
              method: "auto",
              callback: async () => {
                while (true) {
                  const response = await fetch(urls.ACCESS_TOKEN_URL, {
                    method: "POST",
                    headers: {
                      Accept: "application/json",
                      "Content-Type": "application/json",
                      "User-Agent": "GitHubCopilotChat/0.35.0",
                    },
                    body: JSON.stringify({
                      client_id: CLIENT_ID,
                      device_code: deviceData.device_code,
                      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
                    }),
                  })

                  if (!response.ok) return { type: "failed" }

                  const data = await response.json()

                  if (data.access_token) {
                    const result = {
                      type: "success",
                      refresh: data.access_token,
                      access: "",
                      expires: 0,
                    }

                    if (actualProvider === "github-copilot-enterprise") {
                      result.provider = "github-copilot-enterprise"
                      result.enterpriseUrl = domain
                    }

                    return result
                  }

                  if (data.error === "authorization_pending") {
                    await new Promise((resolve) => setTimeout(resolve, deviceData.interval * 1000))
                    continue
                  }

                  if (data.error) return { type: "failed" }

                  await new Promise((resolve) => setTimeout(resolve, deviceData.interval * 1000))
                  continue
                }
              },
            }
          },
        },
      ],
    },
  }
}
