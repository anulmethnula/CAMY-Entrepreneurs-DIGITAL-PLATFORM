$reportPath = Join-Path $PSScriptRoot '../private/review/report-format-test.xlsx'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::OpenRead((Resolve-Path -LiteralPath $reportPath))
try {
    $sheetCount = 0
    foreach ($entry in $archive.Entries) {
        $reader = New-Object System.IO.StreamReader($entry.Open())
        try { [xml]$document = $reader.ReadToEnd() } finally { $reader.Dispose() }
        if ($entry.FullName -like 'xl/worksheets/*.xml') {
            $sheetCount++
            $namespaces = New-Object System.Xml.XmlNamespaceManager($document.NameTable)
            $namespaces.AddNamespace('s', 'http://schemas.openxmlformats.org/spreadsheetml/2006/main')
            if (-not $document.SelectSingleNode('//s:pane[@state="frozen"]', $namespaces)) { throw 'Missing frozen header' }
            if (-not $document.SelectSingleNode('//s:autoFilter', $namespaces)) { throw 'Missing filter' }
            if ($document.SelectSingleNode('//s:f', $namespaces)) { throw 'Untrusted input became a formula' }
        }
    }
    if ($sheetCount -ne 4) { throw 'Expected four report sheets' }
    Write-Output 'PASS: Independent .NET ZIP reader and XML parser validated all workbook parts and four worksheets.'
} finally { $archive.Dispose() }
