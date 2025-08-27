import { $ } from "bun"
import { Mock } from "./mock"
import { Auth } from "./auth"
import { Context } from "./context"

export namespace Git {
  const CONFIG_KEY = "http.https://github.com/.extraheader"
  let extraHeaderValue: string | undefined

  export async function configure() {
    // Do not change git config when running locally
    if (Mock.isMock()) return

    console.log("Configuring git...")
    const ret = await $`git config --local --get ${CONFIG_KEY}`
    const value = ret.stdout.toString().trim()
    // configure() can be called multiple times, backup the value from the first call
    extraHeaderValue = extraHeaderValue ?? value

    const appToken = await Auth.token()
    const newCredentials = Buffer.from(`x-access-token:${appToken}`, "utf8").toString("base64")

    await $`git config --local --unset-all ${CONFIG_KEY}`
    await $`git config --local ${CONFIG_KEY} "AUTHORIZATION: basic ${newCredentials}"`
    await $`git config --global user.name "opencode-agent[bot]"`
    await $`git config --global user.email "opencode-agent[bot]@users.noreply.github.com"`
  }

  export async function restore() {
    console.log("Restoring git config...")

    if (!extraHeaderValue) return

    await $`git config --local ${CONFIG_KEY} "${extraHeaderValue}"`
  }

  export function isForkedPr() {
    const pr = Context.payloadPullRequest()
    return pr.head.repo?.full_name !== pr.base.repo.full_name
  }

  export async function checkoutPrBranch() {
    console.log("Checking out PR branch...")

    const pr = Context.payloadPullRequest()
    const depth = Math.max(pr.commits, 20)
    const fromBranch = pr.head.ref

    if (isForkedPr()) {
      const newBranch = generateBranchName("pr")
      await $`git remote add fork https://github.com/${pr.head.repo?.full_name}.git`
      await $`git fetch fork --depth=${depth} ${fromBranch}`
      await $`git checkout -b ${newBranch} fork/${fromBranch}`
    } else {
      await $`git fetch origin --depth=${depth} ${fromBranch}`
      await $`git checkout ${fromBranch}`
    }
  }

  export async function pushBranch(message: string) {
    console.log("Pushing branch...")

    await $`git add .`
    await $`git commit -m "${message}

Co-authored-by: ${Context.actor()} <${Context.actor()}@users.noreply.github.com>"`

    const pr = Context.payloadPullRequest()
    const fromBranch = pr.head.ref
    if (isForkedPr()) {
      await $`git push fork HEAD:${fromBranch}`
    } else {
      await $`git push`
    }
  }

  export async function resetBranch() {
    console.log("Resetting branch...")
    await $`git clean -fd`
    await $`git reset --hard HEAD`
  }

  function generateBranchName(type: "issue" | "pr") {
    const pr = Context.payloadPullRequest()
    const timestamp = new Date()
      .toISOString()
      .replace(/[:-]/g, "")
      .replace(/\.\d{3}Z/, "")
      .split("T")
      .join("")
    return `opencode/${type}${pr.number}-${timestamp}`
  }
}
