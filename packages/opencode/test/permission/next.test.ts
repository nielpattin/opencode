import { test, expect } from "bun:test"
import { PermissionNext } from "../../src/permission/next"

// fromConfig tests

test("fromConfig - string value becomes wildcard rule", () => {
  const result = PermissionNext.fromConfig({ bash: "allow" })
  expect(result).toEqual([{ permission: "bash", pattern: "*", action: "allow" }])
})

test("fromConfig - object value converts to rules array", () => {
  const result = PermissionNext.fromConfig({ bash: { "*": "allow", rm: "deny" } })
  expect(result).toEqual([
    { permission: "bash", pattern: "*", action: "allow" },
    { permission: "bash", pattern: "rm", action: "deny" },
  ])
})

test("fromConfig - mixed string and object values", () => {
  const result = PermissionNext.fromConfig({
    bash: { "*": "allow", rm: "deny" },
    edit: "allow",
    webfetch: "ask",
  })
  expect(result).toEqual([
    { permission: "bash", pattern: "*", action: "allow" },
    { permission: "bash", pattern: "rm", action: "deny" },
    { permission: "edit", pattern: "*", action: "allow" },
    { permission: "webfetch", pattern: "*", action: "ask" },
  ])
})

test("fromConfig - empty object", () => {
  const result = PermissionNext.fromConfig({})
  expect(result).toEqual([])
})

// merge tests

test("merge - simple concatenation", () => {
  const result = PermissionNext.merge(
    [{ permission: "bash", pattern: "*", action: "allow" }],
    [{ permission: "bash", pattern: "*", action: "deny" }],
  )
  expect(result).toEqual([
    { permission: "bash", pattern: "*", action: "allow" },
    { permission: "bash", pattern: "*", action: "deny" },
  ])
})

test("merge - adds new permission", () => {
  const result = PermissionNext.merge(
    [{ permission: "bash", pattern: "*", action: "allow" }],
    [{ permission: "edit", pattern: "*", action: "deny" }],
  )
  expect(result).toEqual([
    { permission: "bash", pattern: "*", action: "allow" },
    { permission: "edit", pattern: "*", action: "deny" },
  ])
})

test("merge - concatenates rules for same permission", () => {
  const result = PermissionNext.merge(
    [{ permission: "bash", pattern: "foo", action: "ask" }],
    [{ permission: "bash", pattern: "*", action: "deny" }],
  )
  expect(result).toEqual([
    { permission: "bash", pattern: "foo", action: "ask" },
    { permission: "bash", pattern: "*", action: "deny" },
  ])
})

test("merge - multiple rulesets", () => {
  const result = PermissionNext.merge(
    [{ permission: "bash", pattern: "*", action: "allow" }],
    [{ permission: "bash", pattern: "rm", action: "ask" }],
    [{ permission: "edit", pattern: "*", action: "allow" }],
  )
  expect(result).toEqual([
    { permission: "bash", pattern: "*", action: "allow" },
    { permission: "bash", pattern: "rm", action: "ask" },
    { permission: "edit", pattern: "*", action: "allow" },
  ])
})

test("merge - empty ruleset does nothing", () => {
  const result = PermissionNext.merge([{ permission: "bash", pattern: "*", action: "allow" }], [])
  expect(result).toEqual([{ permission: "bash", pattern: "*", action: "allow" }])
})

test("merge - preserves rule order", () => {
  const result = PermissionNext.merge(
    [
      { permission: "edit", pattern: "src/*", action: "allow" },
      { permission: "edit", pattern: "src/secret/*", action: "deny" },
    ],
    [{ permission: "edit", pattern: "src/secret/ok.ts", action: "allow" }],
  )
  expect(result).toEqual([
    { permission: "edit", pattern: "src/*", action: "allow" },
    { permission: "edit", pattern: "src/secret/*", action: "deny" },
    { permission: "edit", pattern: "src/secret/ok.ts", action: "allow" },
  ])
})

test("merge - config permission overrides default ask", () => {
  // Simulates: defaults have "*": "ask", config sets bash: "allow"
  const defaults: PermissionNext.Ruleset = [{ permission: "*", pattern: "*", action: "ask" }]
  const config: PermissionNext.Ruleset = [{ permission: "bash", pattern: "*", action: "allow" }]
  const merged = PermissionNext.merge(defaults, config)

  // Config's bash allow should override default ask
  expect(PermissionNext.evaluate("bash", "ls", merged)).toBe("allow")
  // Other permissions should still be ask (from defaults)
  expect(PermissionNext.evaluate("edit", "foo.ts", merged)).toBe("ask")
})

test("merge - config ask overrides default allow", () => {
  // Simulates: defaults have bash: "allow", config sets bash: "ask"
  const defaults: PermissionNext.Ruleset = [{ permission: "bash", pattern: "*", action: "allow" }]
  const config: PermissionNext.Ruleset = [{ permission: "bash", pattern: "*", action: "ask" }]
  const merged = PermissionNext.merge(defaults, config)

  // Config's ask should override default allow
  expect(PermissionNext.evaluate("bash", "ls", merged)).toBe("ask")
})

// evaluate tests

test("evaluate - exact pattern match", () => {
  const result = PermissionNext.evaluate("bash", "rm", [{ permission: "bash", pattern: "rm", action: "deny" }])
  expect(result).toBe("deny")
})

test("evaluate - wildcard pattern match", () => {
  const result = PermissionNext.evaluate("bash", "rm", [{ permission: "bash", pattern: "*", action: "allow" }])
  expect(result).toBe("allow")
})

test("evaluate - last matching rule wins", () => {
  const result = PermissionNext.evaluate("bash", "rm", [
    { permission: "bash", pattern: "*", action: "allow" },
    { permission: "bash", pattern: "rm", action: "deny" },
  ])
  expect(result).toBe("deny")
})

test("evaluate - last matching rule wins (wildcard after specific)", () => {
  const result = PermissionNext.evaluate("bash", "rm", [
    { permission: "bash", pattern: "rm", action: "deny" },
    { permission: "bash", pattern: "*", action: "allow" },
  ])
  expect(result).toBe("allow")
})

test("evaluate - glob pattern match", () => {
  const result = PermissionNext.evaluate("edit", "src/foo.ts", [
    { permission: "edit", pattern: "src/*", action: "allow" },
  ])
  expect(result).toBe("allow")
})

test("evaluate - last matching glob wins", () => {
  const result = PermissionNext.evaluate("edit", "src/components/Button.tsx", [
    { permission: "edit", pattern: "src/*", action: "deny" },
    { permission: "edit", pattern: "src/components/*", action: "allow" },
  ])
  expect(result).toBe("allow")
})

test("evaluate - order matters for specificity", () => {
  // If more specific rule comes first, later wildcard overrides it
  const result = PermissionNext.evaluate("edit", "src/components/Button.tsx", [
    { permission: "edit", pattern: "src/components/*", action: "allow" },
    { permission: "edit", pattern: "src/*", action: "deny" },
  ])
  expect(result).toBe("deny")
})

test("evaluate - unknown permission returns ask", () => {
  const result = PermissionNext.evaluate("unknown_tool", "anything", [
    { permission: "bash", pattern: "*", action: "allow" },
  ])
  expect(result).toBe("ask")
})

test("evaluate - empty ruleset returns ask", () => {
  const result = PermissionNext.evaluate("bash", "rm", [])
  expect(result).toBe("ask")
})

test("evaluate - no matching pattern returns ask", () => {
  const result = PermissionNext.evaluate("edit", "etc/passwd", [
    { permission: "edit", pattern: "src/*", action: "allow" },
  ])
  expect(result).toBe("ask")
})

test("evaluate - empty rules array returns ask", () => {
  const result = PermissionNext.evaluate("bash", "rm", [])
  expect(result).toBe("ask")
})

test("evaluate - multiple matching patterns, last wins", () => {
  const result = PermissionNext.evaluate("edit", "src/secret.ts", [
    { permission: "edit", pattern: "*", action: "ask" },
    { permission: "edit", pattern: "src/*", action: "allow" },
    { permission: "edit", pattern: "src/secret.ts", action: "deny" },
  ])
  expect(result).toBe("deny")
})

test("evaluate - non-matching patterns are skipped", () => {
  const result = PermissionNext.evaluate("edit", "src/foo.ts", [
    { permission: "edit", pattern: "*", action: "ask" },
    { permission: "edit", pattern: "test/*", action: "deny" },
    { permission: "edit", pattern: "src/*", action: "allow" },
  ])
  expect(result).toBe("allow")
})

test("evaluate - exact match at end wins over earlier wildcard", () => {
  const result = PermissionNext.evaluate("bash", "/bin/rm", [
    { permission: "bash", pattern: "*", action: "allow" },
    { permission: "bash", pattern: "/bin/rm", action: "deny" },
  ])
  expect(result).toBe("deny")
})

test("evaluate - wildcard at end overrides earlier exact match", () => {
  const result = PermissionNext.evaluate("bash", "/bin/rm", [
    { permission: "bash", pattern: "/bin/rm", action: "deny" },
    { permission: "bash", pattern: "*", action: "allow" },
  ])
  expect(result).toBe("allow")
})

// wildcard permission tests

test("evaluate - wildcard permission matches any permission", () => {
  const result = PermissionNext.evaluate("bash", "rm", [{ permission: "*", pattern: "*", action: "deny" }])
  expect(result).toBe("deny")
})

test("evaluate - wildcard permission with specific pattern", () => {
  const result = PermissionNext.evaluate("bash", "rm", [{ permission: "*", pattern: "rm", action: "deny" }])
  expect(result).toBe("deny")
})

test("evaluate - glob permission pattern", () => {
  const result = PermissionNext.evaluate("mcp_server_tool", "anything", [
    { permission: "mcp_*", pattern: "*", action: "allow" },
  ])
  expect(result).toBe("allow")
})

test("evaluate - specific permission and wildcard permission combined", () => {
  const result = PermissionNext.evaluate("bash", "rm", [
    { permission: "*", pattern: "*", action: "deny" },
    { permission: "bash", pattern: "*", action: "allow" },
  ])
  expect(result).toBe("allow")
})

test("evaluate - wildcard permission does not match when specific exists", () => {
  const result = PermissionNext.evaluate("edit", "src/foo.ts", [
    { permission: "*", pattern: "*", action: "deny" },
    { permission: "edit", pattern: "src/*", action: "allow" },
  ])
  expect(result).toBe("allow")
})

test("evaluate - multiple matching permission patterns combine rules", () => {
  const result = PermissionNext.evaluate("mcp_dangerous", "anything", [
    { permission: "*", pattern: "*", action: "ask" },
    { permission: "mcp_*", pattern: "*", action: "allow" },
    { permission: "mcp_dangerous", pattern: "*", action: "deny" },
  ])
  expect(result).toBe("deny")
})

test("evaluate - wildcard permission fallback for unknown tool", () => {
  const result = PermissionNext.evaluate("unknown_tool", "anything", [
    { permission: "*", pattern: "*", action: "ask" },
    { permission: "bash", pattern: "*", action: "allow" },
  ])
  expect(result).toBe("ask")
})

test("evaluate - permission patterns sorted by length regardless of object order", () => {
  // specific permission listed before wildcard, but specific should still win
  const result = PermissionNext.evaluate("bash", "rm", [
    { permission: "bash", pattern: "*", action: "allow" },
    { permission: "*", pattern: "*", action: "deny" },
  ])
  // With flat list, last matching rule wins - so "*" matches bash and wins
  expect(result).toBe("deny")
})

// disabled tests

test("disabled - returns empty set when all tools allowed", () => {
  const result = PermissionNext.disabled(["bash", "edit", "read"], [{ permission: "*", pattern: "*", action: "allow" }])
  expect(result.size).toBe(0)
})

test("disabled - disables tool when denied", () => {
  const result = PermissionNext.disabled(
    ["bash", "edit", "read"],
    [
      { permission: "*", pattern: "*", action: "allow" },
      { permission: "bash", pattern: "*", action: "deny" },
    ],
  )
  expect(result.has("bash")).toBe(true)
  expect(result.has("edit")).toBe(false)
  expect(result.has("read")).toBe(false)
})

test("disabled - disables edit/write/patch/multiedit when edit denied", () => {
  const result = PermissionNext.disabled(
    ["edit", "write", "patch", "multiedit", "bash"],
    [
      { permission: "*", pattern: "*", action: "allow" },
      { permission: "edit", pattern: "*", action: "deny" },
    ],
  )
  expect(result.has("edit")).toBe(true)
  expect(result.has("write")).toBe(true)
  expect(result.has("patch")).toBe(true)
  expect(result.has("multiedit")).toBe(true)
  expect(result.has("bash")).toBe(false)
})

test("disabled - does not disable when partially denied", () => {
  const result = PermissionNext.disabled(
    ["bash"],
    [
      { permission: "bash", pattern: "*", action: "allow" },
      { permission: "bash", pattern: "rm *", action: "deny" },
    ],
  )
  expect(result.has("bash")).toBe(false)
})

test("disabled - does not disable when action is ask", () => {
  const result = PermissionNext.disabled(["bash", "edit"], [{ permission: "*", pattern: "*", action: "ask" }])
  expect(result.size).toBe(0)
})

test("disabled - disables when wildcard deny even with specific allow", () => {
  // Tool is disabled because evaluate("bash", "*", ...) returns "deny"
  // The "echo *" allow rule doesn't match the "*" pattern we're checking
  const result = PermissionNext.disabled(
    ["bash"],
    [
      { permission: "bash", pattern: "*", action: "deny" },
      { permission: "bash", pattern: "echo *", action: "allow" },
    ],
  )
  expect(result.has("bash")).toBe(true)
})

test("disabled - does not disable when wildcard allow after deny", () => {
  const result = PermissionNext.disabled(
    ["bash"],
    [
      { permission: "bash", pattern: "rm *", action: "deny" },
      { permission: "bash", pattern: "*", action: "allow" },
    ],
  )
  expect(result.has("bash")).toBe(false)
})

test("disabled - disables multiple tools", () => {
  const result = PermissionNext.disabled(
    ["bash", "edit", "webfetch"],
    [
      { permission: "bash", pattern: "*", action: "deny" },
      { permission: "edit", pattern: "*", action: "deny" },
      { permission: "webfetch", pattern: "*", action: "deny" },
    ],
  )
  expect(result.has("bash")).toBe(true)
  expect(result.has("edit")).toBe(true)
  expect(result.has("webfetch")).toBe(true)
})

test("disabled - wildcard permission denies all tools", () => {
  const result = PermissionNext.disabled(["bash", "edit", "read"], [{ permission: "*", pattern: "*", action: "deny" }])
  expect(result.has("bash")).toBe(true)
  expect(result.has("edit")).toBe(true)
  expect(result.has("read")).toBe(true)
})

test("disabled - specific allow overrides wildcard deny", () => {
  const result = PermissionNext.disabled(
    ["bash", "edit", "read"],
    [
      { permission: "*", pattern: "*", action: "deny" },
      { permission: "bash", pattern: "*", action: "allow" },
    ],
  )
  expect(result.has("bash")).toBe(false)
  expect(result.has("edit")).toBe(true)
  expect(result.has("read")).toBe(true)
})
