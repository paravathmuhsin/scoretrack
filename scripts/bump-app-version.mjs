import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const bumpType = process.argv[2] ?? 'patch'
if (!['patch', 'minor', 'major'].includes(bumpType)) {
  console.error('Usage: node scripts/bump-app-version.mjs [patch|minor|major]')
  process.exit(1)
}

function bumpSemver(version, type) {
  const [major, minor, patch] = version.split('.').map(Number)
  switch (type) {
    case 'major':
      return `${major + 1}.0.0`
    case 'minor':
      return `${major}.${minor + 1}.0`
    case 'patch':
      return `${major}.${minor}.${patch + 1}`
  }
}

const pkgPath = join(root, 'package.json')
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
const oldVersion = pkg.version
const newVersion = bumpSemver(oldVersion, bumpType)

pkg.version = newVersion
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)

const gradlePath = join(root, 'android/app/build.gradle')
let gradle = readFileSync(gradlePath, 'utf8')
const versionCodeMatch = gradle.match(/versionCode (\d+)/)
const newVersionCode = versionCodeMatch ? Number(versionCodeMatch[1]) + 1 : 1
gradle = gradle.replace(/versionCode \d+/, `versionCode ${newVersionCode}`)
gradle = gradle.replace(/versionName "[^"]+"/, `versionName "${newVersion}"`)
writeFileSync(gradlePath, gradle)

const pbxPath = join(root, 'ios/App/App.xcodeproj/project.pbxproj')
let pbx = readFileSync(pbxPath, 'utf8')
pbx = pbx.replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${newVersion};`)
const currentProjMatch = pbx.match(/CURRENT_PROJECT_VERSION = (\d+);/)
const newCurrentProjectVersion = currentProjMatch ? Number(currentProjMatch[1]) + 1 : 1
pbx = pbx.replace(
  /CURRENT_PROJECT_VERSION = \d+;/g,
  `CURRENT_PROJECT_VERSION = ${newCurrentProjectVersion};`,
)
writeFileSync(pbxPath, pbx)

console.log(`${oldVersion} → ${newVersion} (Android versionCode ${newVersionCode})`)
