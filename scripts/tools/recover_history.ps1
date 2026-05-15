# Script to recover VS Code local history files from today
$historyPath = "$env:APPDATA\Code\User\History"
$recoveryPath = "c:\Users\user\Desktop\lole\recovered_files"
$today = Get-Date -Format 'yyyy-MM-dd'

# Create recovery directory
if (-not (Test-Path $recoveryPath)) {
    New-Item -ItemType Directory -Path $recoveryPath | Out-Null
}

# Get all entries.json files
$entries = Get-ChildItem -Path $historyPath -Recurse -Filter 'entries.json'

foreach ($entryFile in $entries) {
    $json = Get-Content $entryFile.FullName | ConvertFrom-Json
    $resource = $json.resource
    $folder = $entryFile.DirectoryName
    
    # Decode the resource path
    $decodedPath = $resource -replace 'file:///', ''
    $decodedPath = $decodedPath -replace 'file:', ''
    $decodedPath = [Uri]::UnescapeDataString($decodedPath)
    
    # Check each entry for today's changes
    foreach ($entry in $json.entries) {
        $ts = [DateTimeOffset]::FromUnixTimeMilliseconds($entry.timestamp).LocalDateTime
        $entryDate = $ts.ToString('yyyy-MM-dd')
        
        if ($entryDate -eq $today) {
            $historyFile = Join-Path $folder $entry.id
            
            if (Test-Path $historyFile) {
                # Create a descriptive filename
                $timeStamp = $ts.ToString('HH-mm-ss')
                $originalName = Split-Path $decodedPath -Leaf
                $relativePath = $decodedPath -replace '^[A-Za-z]:/Users/user/Desktop/lole/', ''
                $relativePath = $relativePath -replace '/', '_'
                
                $recoveryName = "${timeStamp}_${relativePath}"
                $recoveryFile = Join-Path $recoveryPath $recoveryName
                
                Copy-Item $historyFile $recoveryFile -Force
                Write-Output "Recovered: $recoveryName"
            }
        }
    }
}

Write-Output "`nRecovery complete! Files saved to: $recoveryPath"