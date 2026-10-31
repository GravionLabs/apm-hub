---
layout: home
title: apm-hub
editLink: false
hero:
  name: apm-hub
  text: Cross-platform agent skills
  tagline: Archived — successor GravionLabs/skills. A curated hub of skills, distributed as APM packages, that load unchanged on GitHub Copilot, Claude Code and OpenCode.
  actions:
    - theme: brand
      text: Read the overview
      link: /overview
    - theme: alt
      text: Browse the skills
      link: /skill-list
    - theme: alt
      text: View on GitHub
      link: https://github.com/GravionLabs/apm-hub
features:
  - title: One skill, three clients
    details: Each SKILL.md follows the agentskills.io format and works on Copilot, Claude Code and OpenCode without changes.
  - title: Installable packages
    details: Domain bundles for GitHub, delivery, .NET, TypeScript, Python and Angular, installed into any repository with one apm command.
  - title: Workflows are skills
    details: Issue planning, implementation, review and release are skills that compose; each one owns a workflow and the others delegate to it by name.
  - title: Delivery as a workflow
    details: /deliver runs the implementation and review skills in subagents on Claude Code, OpenCode and Copilot CLI; a GitHub ruleset gates the merge.
---

::: warning apm-hub is archived
Its successor is [GravionLabs/skills](https://github.com/GravionLabs/skills): skills are installed with `npx skills` instead of apm (`npx skills add GravionLabs/skills --skill <name>`, or `/skills-install`). The unreleased `release/next` of apm-hub is not released as 3.4.0; its content ships in GravionLabs/skills v1.0.0. Migration steps: [after-install.md](https://github.com/GravionLabs/skills/blob/main/skills/delivery/skills-install/references/after-install.md). apm-hub 3.3.0 stays installable with apm. Documentation of the successor: [gravionlabs.github.io/skills](https://gravionlabs.github.io/skills/).
:::
