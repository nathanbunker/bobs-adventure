# Builds dist/bobs-adventure.war from src/.
# Drop the WAR into Tomcat's webapps folder and the game is served at /bobs-adventure/.
#
#   powershell -ExecutionPolicy Bypass -File build-war.ps1

$ErrorActionPreference = "Stop"
$root    = $PSScriptRoot
$name    = "bobs-adventure"
$src     = Join-Path $root "src"
$stage   = Join-Path $root "build\$name"
$dist    = Join-Path $root "dist"
$war     = Join-Path $dist "$name.war"
$version = Get-Date -Format "yyyyMMddHHmm"

# Find the jar tool (comes with any JDK)
$jar = (Get-Command jar -ErrorAction SilentlyContinue).Source
if (-not $jar -and $env:JAVA_HOME) { $jar = Join-Path $env:JAVA_HOME "bin\jar.exe" }
if (-not $jar -or -not (Test-Path $jar)) { throw "Can't find 'jar'. Install a JDK or set JAVA_HOME." }

# Fresh staging copy of src/
if (Test-Path $stage) { Remove-Item -Recurse -Force $stage }
New-Item -ItemType Directory -Force $stage, $dist | Out-Null
Copy-Item -Recurse -Path (Join-Path $src "*") -Destination $stage

# Add ?v=<build time> to local script tags so browsers pick up new levels after a deploy
$utf8 = New-Object System.Text.UTF8Encoding $false
Get-ChildItem $stage -Filter *.html | ForEach-Object {
  $html = [System.IO.File]::ReadAllText($_.FullName)
  $html = [regex]::Replace($html, '<script src="([^":]+\.js)"', "<script src=`"`$1?v=$version`"")
  [System.IO.File]::WriteAllText($_.FullName, $html, $utf8)
}

# Minimal web.xml: index.html is the home page
$webInf = Join-Path $stage "WEB-INF"
New-Item -ItemType Directory -Force $webInf | Out-Null
$webXml = @'
<?xml version="1.0" encoding="UTF-8"?>
<web-app xmlns="http://xmlns.jcp.org/xml/ns/javaee"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://xmlns.jcp.org/xml/ns/javaee http://xmlns.jcp.org/xml/ns/javaee/web-app_3_1.xsd"
         version="3.1" metadata-complete="true">
  <display-name>Bob's Adventure</display-name>
  <welcome-file-list>
    <welcome-file>index.html</welcome-file>
  </welcome-file-list>
</web-app>
'@
[System.IO.File]::WriteAllText((Join-Path $webInf "web.xml"), $webXml, $utf8)

# Package it
if (Test-Path $war) { Remove-Item -Force $war }
& $jar --create --file $war -C $stage .
if ($LASTEXITCODE -ne 0) { throw "jar failed" }

Write-Host "Built $war (version $version)"
