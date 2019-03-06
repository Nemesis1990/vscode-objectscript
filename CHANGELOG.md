# Change Log

## [0.7.12]

- added connection setting "objectscript.conn.ignoreConflicts" if disabled the timestamps of the server and local version of a file get's checked. On conflict you will get 3 options to resolve a conflict: "Save local copy", "Save server copy" and "cancel". Default is true
- using "export" now works correctly when using multi-root-workspaces

## [0.7.11]

- added export setting "objectscript.export.addCategory" if enabled uses previous behavior, adds category folder to export folder, disabled by default

## [0.7.10]

- New logo
- Fixed backward compatibility with previous versions of Atelier API
- Fixed issue with license usage, due to loosing cookies
- Some other small fixes

## [0.7.9]

- IMPORTANT: **Connection disabled by default, now**. Set `"objectscript.conn.active": true` to enable it
- Automatically Preview XML files as UDL, (disabled by default, setting `objectscript.autoPreviewXML`)
- Preview XML As UDL by command from Command Palette and from Context Menu
- Fixed highlighting for XData with css in style tag
- Show percent-member in outline
- Multi-root workspace supported now, for different connections
- Multi-root workspace also for server explorer
- Go to definition now goes to real file if such presented, or opens from the server
- Basic syntax highlighting for CSP files, only as HTML
- Added some snippets for class
- Go to Subclass for the current class, available in command palette
- Go to Super class for the current class, available in command palette
- Go To any class/method in the workspace including server (by Cmd+T/Ctrl+T)
- some small fixes in the highlighting, and selecting words/variables
- Intellisense. Show list of methods for ##class(SomeClass)
- Go to macros definition
- Go to definition for methods and properties for self object like `..Name`, `..SomeMethod()`
- Added completion for class parameters
- Export without storage

## [0.7.7]

- Completion for ObjectScript Commands
- Hover documentation for ObjectScript commands
- Text formatter for ObjectScript commands

## [0.7.4]

- Outline improvements
- Hover on system functions with documentation

## [0.7.2]

- Fixed outline's regions
- Better code folding
- Go-To Definition for some cases (As, Extends, Include, ##class)
- Simple completion for system functions and variables, with simple description

## [0.7.0]

- big rewrite of plugin's code, to typescript
- `COS` renamed to `ObjectScript`, affected configuration, language, commands etc.
- Export added in context menu on items in Server Explorer
- Improvements in Syntax highlighting
- Language `ObjectScript Class` class was added, now used just for classes

## [0.6.0]

### Added

- Add "View others files" with shortcut

## [0.5.0]

### Added

- Show outline symbols

## [0.4.0]

### Added

- COS explorer

## [0.3.6]

### Added

- Option "Compile on Save"
- Additional notification window about compilation result

## [0.3.5]

### Added

- Add initial syntax support for ClassQuery
- Add initial syntax support for ForeignKey

### Fixed

- Corrected a bit syntax support for macros

## [0.3.4]

### Added

- Reconnect after change settings

## [0.3.3]

### Added

- Update settings dynamically

## [0.3.2]

### Fixed

- Use fixed version of cos-api4node

## [0.3.1]

### Added

- Export after compile

## [0.2.3]

### Fixed

- Remove unused command

## [0.2.2]

### Added

- Option 'conn.export.folder'
- Option 'conn.export.atelier'
- Export files as Atelier

### Changed

- Configuration syntax

## [0.2.1]

### Fixed

- API encoding

## [0.2.0]

### Added

- Allow https

## [0.1.2]

### Added

- Support \*.mac

## [0.1.1]

### Added

- Additional warnings about compilation

## [0.1.0]

### Added

- Save and compile

## [0.0.6]

### Changed

- Upgrade to cos-api4node v2.0.0

## [0.0.5]

### Fixed

- Do not output connection password

## [0.0.4]

### Added

- Add initial support for \*.inc files

## [0.0.3]

### Added

- Config connection to cos-server
- Export sources (experimental)

## [0.0.1]

- Initial release
