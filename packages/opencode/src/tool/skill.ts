import path from "path"
import z from "zod"
import { Tool } from "./tool"
import { Skill } from "../skill"
import { Agent } from "../agent/agent"
import { Permission } from "../permission"
import { Wildcard } from "../util/wildcard"
import { ConfigMarkdown } from "../config/markdown"

export const SkillTool = Tool.define("skill", async () => {
  const allSkills = await Skill.all()

  return {
    description: [
      "Load a skill to get detailed instructions for a specific task.",
      "Skills provide specialized knowledge and step-by-step guidance.",
      "Use this when a task matches an available skill's description.",
    ].join(" "),
    parameters: z.object({
      id: z.string().describe("The skill identifier from available_skills (e.g., 'code-review' or 'category/helper')"),
    }),
    async execute(params, ctx) {
      const agent = await Agent.get(ctx.agent)
      // Look up by id (path-based identifier)
      const skill = allSkills.find((s) => s.id === params.id)

      if (!skill) {
        const available = allSkills.map((s) => s.id).join(", ")
        throw new Error(`Skill "${params.id}" not found. Available skills: ${available || "none"}`)
      }

      // Check permission using Wildcard.all on the skill ID
      const permissions = agent.permission.skill
      const action = Wildcard.all(params.id, permissions)

      if (action === "deny") {
        throw new Permission.RejectedError(
          ctx.sessionID,
          "skill",
          ctx.callID,
          { skill: params.id },
          `Access to skill "${params.id}" is denied for agent "${agent.name}".`,
        )
      }

      if (action === "ask") {
        await Permission.ask({
          type: "skill",
          pattern: params.id,
          sessionID: ctx.sessionID,
          messageID: ctx.messageID,
          callID: ctx.callID,
          title: `Load skill: ${skill.name}`,
          metadata: { id: params.id, name: skill.name, description: skill.description },
        })
      }

      // Load and parse skill content
      const parsed = await ConfigMarkdown.parse(skill.location)
      const baseDir = path.dirname(skill.location)

      // Format output similar to plugin pattern
      const output = [`## Skill: ${skill.name}`, "", `**Base directory**: ${baseDir}`, "", parsed.content.trim()].join(
        "\n",
      )

      return {
        title: `Loaded skill: ${skill.name}`,
        output,
        metadata: {
          id: skill.id,
          name: skill.name,
          baseDir,
        },
      }
    },
  }
})
