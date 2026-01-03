import { realpathSync } from "fs"
import { exists } from "fs/promises"
import { dirname, join, relative } from "path"

export namespace Filesystem {
  // Convert MSYS2/Git Bash/Cygwin paths to Windows paths (no-op on other platforms)
  export function toNativePath(p: string): string {
    if (process.platform !== "win32") return p
    if (/^\/[a-zA-Z]\//.test(p)) {
      return p.replace(/^\/([a-zA-Z])\//, (_, d) => `${d.toUpperCase()}:\\`).replace(/\//g, "\\")
    }
    if (/^\/cygdrive\/[a-zA-Z]\//.test(p)) {
      return p.replace(/^\/cygdrive\/([a-zA-Z])\//, (_, d) => `${d.toUpperCase()}:\\`).replace(/\//g, "\\")
    }
    return p
  }

  // Convert Windows paths to POSIX paths (for Git Bash compatibility)
  export function toPosixPath(p: string): string {
    if (process.platform !== "win32") return p
    // Convert C:\foo\bar to /c/foo/bar
    return p.replace(/^([a-zA-Z]):/, (_, d) => `/${d.toLowerCase()}`).replace(/\\/g, "/")
  }

  // Normalize path casing on Windows using filesystem
  export function normalizePath(p: string): string {
    if (process.platform !== "win32") return p
    try {
      return realpathSync.native(p)
    } catch {
      return p
    }
  }
  export function overlaps(a: string, b: string) {
    const relA = relative(a, b)
    const relB = relative(b, a)
    return !relA || !relA.startsWith("..") || !relB || !relB.startsWith("..")
  }

  export function contains(parent: string, child: string) {
    return !relative(parent, child).startsWith("..")
  }

  // Safe relative path - returns absolute if cross-drive or too many parent traversals
  export function safeRelative(from: string, to: string): string {
    if (process.platform === "win32") {
      const fromDrive = from.match(/^([a-zA-Z]):/)?.[1]?.toUpperCase()
      const toDrive = to.match(/^([a-zA-Z]):/)?.[1]?.toUpperCase()
      if (fromDrive && toDrive && fromDrive !== toDrive) return to
    }
    const rel = relative(from, to)
    // If path has 3+ parent traversals, use absolute path instead
    if (/^(\.\.[/\\]){3,}/.test(rel)) return to
    return rel
  }

  export async function findUp(target: string, start: string, stop?: string) {
    let current = start
    const result = []
    while (true) {
      const search = join(current, target)
      if (await exists(search)) result.push(search)
      if (stop === current) break
      const parent = dirname(current)
      if (parent === current) break
      current = parent
    }
    return result
  }

  export async function* up(options: { targets: string[]; start: string; stop?: string }) {
    const { targets, start, stop } = options
    let current = start
    while (true) {
      for (const target of targets) {
        const search = join(current, target)
        if (await exists(search)) yield search
      }
      if (stop === current) break
      const parent = dirname(current)
      if (parent === current) break
      current = parent
    }
  }

  export async function globUp(pattern: string, start: string, stop?: string) {
    let current = start
    const result = []
    while (true) {
      try {
        const glob = new Bun.Glob(pattern)
        for await (const match of glob.scan({
          cwd: current,
          absolute: true,
          onlyFiles: true,
          followSymlinks: true,
          dot: true,
        })) {
          result.push(match)
        }
      } catch {
        // Skip invalid glob patterns
      }
      if (stop === current) break
      const parent = dirname(current)
      if (parent === current) break
      current = parent
    }
    return result
  }
}
