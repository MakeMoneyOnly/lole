$historyPath = "$env:APPDATA\Code\User\History"
$recentFiles = @()

Get-ChildItem -Path $historyPath -Recurse -Filter 'entries.json' | ForEach-Object {
    $json = Get-Content $_.FullName | ConvertFrom-Json
    $resource = $json.resource
    $folder = $_.DirectoryName
    
    foreach ($entry in $json.entries) {
        $ts = [DateTimeOffset]::FromUnixTimeMilliseconds($entry.timestamp).LocalDateTime
        $recentFiles += [PSCustomObject]@{
            Timestamp = $ts
            Date = $ts.ToString('yyyy-MM-dd')
            Time = $ts.ToString('HH:mm:ss')
            Resource = [System.Web.HttpUtility]::UrlDecode($resource -replace 'file:///', '')
            FileId = $entry.id
            Folder = $folder
        }
    }
}

# Filter for today and sort by timestamp descending
$recentFiles | Where-Object { $_.Timestamp -gt (Get-Date).AddDays(-1) } | Sort-Object Timestamp -Descending | ForEach-Object {
    Write-Output "$($_.Date) $($_.Time) | $($_.Resource) | $($_.Folder)\$($_.FileId)"
}