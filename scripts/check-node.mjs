const [major, minor] = process.versions.node.split('.').map(Number)

if (major > 26 || (major === 26 && minor >= 3)) {
  process.exit(0)
}

console.error(`
PDF Unlocker uses Vue TermUI, which needs Node.js 26.3 or newer
(OpenTUI's FFI renderer). This environment has v${process.versions.node}.

Install Node 26+, then retry:

  nvm install 26
  nvm use 26
  npm run dev:tui
`)
process.exit(1)
