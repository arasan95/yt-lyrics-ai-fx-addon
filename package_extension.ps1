# Extension Packaging Script
$version = "v2.1"
$zipName = "youtube_extension_$version.zip"
$exclude = @(".git", ".vscode", "*.zip", "*.ps1", "node_modules")

Write-Host "Packaging extension version $version..."

# Remove old zip if exists
if (Test-Path $zipName) {
    Remove-Item $zipName
}

# Create a temporary directory for clean packaging
$tempDir = "temp_package"
if (Test-Path $tempDir) {
    Remove-Item $tempDir -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $tempDir | Out-Null

# Copy files
$files = Get-ChildItem -Path . -Exclude $exclude
foreach ($file in $files) {
    if ($file.Name -ne $tempDir) {
        Copy-Item -Path $file.FullName -Destination $tempDir -Recurse
    }
}

# Zip the contents of the temp directory
Compress-Archive -Path "$tempDir/*" -DestinationPath $zipName

# Clean up
Remove-Item $tempDir -Recurse -Force

Write-Host "Successfully created $zipName"
Write-Host "Use this zip file to upload to the store or load as an extension."
