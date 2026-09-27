# Installs the Node.js runtime Stream Deck needs from this kit
# to the Stream Deck folder for its runtime environments.
#
#     install.cmd
#
# Checks the runtime's sha256 against CHECKSUMS.txt and its code
# signature before copying anything, and needs no administrator rights.

$ErrorActionPreference = 'Stop'

$Signer = 'OpenJS Foundation'

function Stop-Install([string] $Message) {
  Write-Host ''
  Write-Host "Not installed: $Message" -ForegroundColor Red
  exit 1
}

$Kit = Split-Path -Parent $PSScriptRoot
$Version = (Get-Content -LiteralPath (Join-Path $Kit 'VERSION') -Raw).Trim()

if ($Version -notmatch '^\d+\.\d+\.\d+$') {
  Stop-Install "the kit's VERSION file does not hold a release number."
}

if (Get-Process -Name 'StreamDeck' -ErrorAction SilentlyContinue) {
  Stop-Install 'Stream Deck is running. Quit it from its icon in the taskbar tray, then run this again.'
}

if (-not $env:APPDATA) {
  Stop-Install 'Windows did not say where this account keeps application data (APPDATA).'
}

$StreamDeck = Join-Path $env:APPDATA 'Elgato\StreamDeck'

if (-not (Test-Path -LiteralPath $StreamDeck -PathType Container)) {
  Stop-Install "no Stream Deck folder at $StreamDeck. Install Stream Deck and start it once first."
}

try {
  $Architecture = [System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture.ToString()
} catch {
  $Architecture = $env:PROCESSOR_ARCHITECTURE
}

$Arch = switch ($Architecture) {
  { $_ -in 'X64', 'AMD64' } { 'x64' }
  { $_ -in 'Arm64', 'ARM64' } { 'arm64' }
  default { Stop-Install "this kit has no runtime for a $Architecture processor." }
}

$Entry = "windows/$Arch/node.exe"
$Runtime = Join-Path $Kit "windows\$Arch\node.exe"

if (-not (Test-Path -LiteralPath $Runtime -PathType Leaf)) {
  Stop-Install "the kit is missing $Entry."
}

$Expected = $null

foreach ($Line in Get-Content -LiteralPath (Join-Path $Kit 'CHECKSUMS.txt')) {
  if ($Line -match '^([0-9a-f]{64})  (\S+)$' -and $Matches[2] -eq $Entry) {
    $Expected = $Matches[1]
  }
}

if (-not $Expected) {
  Stop-Install "CHECKSUMS.txt has no line for $Entry."
}

$Actual = (Get-FileHash -LiteralPath $Runtime -Algorithm SHA256).Hash.ToLowerInvariant()

if ($Actual -ne $Expected) {
  Stop-Install "$Entry does not match CHECKSUMS.txt. Expected $Expected, found $Actual."
}

Write-Host "Checked the sha256 of $Entry"

$Signature = Get-AuthenticodeSignature -LiteralPath $Runtime

if ($Signature.Status -ne 'Valid') {
  Stop-Install "Windows could not confirm the runtime's signature ($($Signature.Status): $($Signature.StatusMessage))."
}

if ($Signature.SignerCertificate.Subject -notmatch "CN=`"?$Signer`"?(,|$)") {
  Stop-Install "the runtime is signed by $($Signature.SignerCertificate.Subject), not the $Signer."
}

Write-Host "Checked the signature: $Signer"

$NodeFolder = Join-Path $StreamDeck 'NodeJS'
$Target = Join-Path $NodeFolder $Version
$Manifest = Join-Path $NodeFolder 'manifest.json'

# Read before anything is written, so a manifest this cannot read stops the install untouched
$Current = [pscustomobject]@{}
$Others = @()

if (Test-Path -LiteralPath $Manifest -PathType Leaf) {
  try {
    $Current = Get-Content -LiteralPath $Manifest -Raw | ConvertFrom-Json
  } catch {
    Stop-Install "Stream Deck's $Manifest could not be read as JSON. Move it aside and run this again."
  }

  $Others = @($Current.nodejs | Where-Object { $_ -and $_.version -ne $Version })
}

New-Item -ItemType Directory -Force -Path $Target | Out-Null
Copy-Item -LiteralPath $Runtime -Destination (Join-Path $Target 'node.exe') -Force

$Copied = (Get-FileHash -LiteralPath (Join-Path $Target 'node.exe') -Algorithm SHA256).Hash.ToLowerInvariant()

if ($Copied -ne $Expected) {
  Stop-Install "the copy in $Target does not match the kit. The drive may be failing."
}

# Any other runtime Stream Deck holds, such as Node.js 20, keeps its entry
$Entries = @($Others) + @([pscustomobject]@{ path = "$Version\node.exe"; version = $Version })
$Current | Add-Member -NotePropertyName 'nodejs' -NotePropertyValue $Entries -Force
$Json = ConvertTo-Json -InputObject $Current -Depth 4 -Compress

# Stream Deck reads the file as UTF-8 with no byte order mark
[System.IO.File]::WriteAllText($Manifest, $Json, (New-Object System.Text.UTF8Encoding $false))

Write-Host ''
Write-Host "Installed Node.js $Version for Stream Deck in $Target" -ForegroundColor Green
Write-Host 'Start Stream Deck. The plugin runs without the internet from now on.'
