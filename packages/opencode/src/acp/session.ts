import { RequestError, type McpServer } from "@agentclientprotocol/sdk"
import { Provider } from "../provider/provider"
import type { ACPSessionState } from "./types"
import { Log } from "@/util/log"

const log = Log.create({ service: "acp-session-manager" })

export class ACPSessionManager {
  private sessions = new Map<string, ACPSessionState>()

  async create(
    sessionId: string,
    cwd: string,
    mcpServers: McpServer[],
    model?: ACPSessionState["model"],
  ): Promise<ACPSessionState> {
    const resolvedModel = model ?? (await Provider.defaultModel())

    const state: ACPSessionState = {
      id: sessionId,
      cwd,
      mcpServers,
      createdAt: new Date(),
      model: resolvedModel,
    }
    log.info("creating_session", { state })

    this.sessions.set(sessionId, state)
    return state
  }

  get(sessionId: string) {
    const session = this.sessions.get(sessionId)
    if (!session) {
      log.error("session not found", { sessionId })
      throw RequestError.invalidParams(JSON.stringify({ error: `Session not found: ${sessionId}` }))
    }
    return session
  }

  async remove(sessionId: string) {
    this.sessions.delete(sessionId)
  }

  has(sessionId: string) {
    return this.sessions.has(sessionId)
  }

  getModel(sessionId: string) {
    const session = this.sessions.get(sessionId)
    if (!session) return
    return session.model
  }

  setModel(sessionId: string, model: ACPSessionState["model"]) {
    const session = this.sessions.get(sessionId)
    if (!session) return
    session.model = model
    this.sessions.set(sessionId, session)
    return session
  }

  setMode(sessionId: string, modeId: string) {
    const session = this.sessions.get(sessionId)
    if (!session) return
    session.modeId = modeId
    this.sessions.set(sessionId, session)
    return session
  }
}
