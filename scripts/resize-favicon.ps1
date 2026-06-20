# Resize favicon to standard sizes
Add-Type -AssemblyName System.Drawing

$sourcePath = "website/favicon.png"
$outputDir = "website"

$sizes = @(16, 32, 48, 64, 128, 192, 512)

$srcImg = [System.Drawing.Image]::FromFile($sourcePath)

foreach ($size in $sizes) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $graphics = [System.Drawing.Graphics]::FromImage($bmp)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.DrawImage($srcImg, 0, 0, $size, $size)
    $graphics.Dispose()

    $outputPath = "$outputDir/favicon-$size`x$size.png"
    $bmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()

    Write-Output "Created: $outputPath"
}

# Create favicon.ico - use multi-size PNG approach (PNGs inside ICO work on modern browsers/Windows)
$icoPath = "$outputDir/favicon.ico"

# Read the 32x32 PNG bytes to embed in ICO
$pngBytes = [System.IO.File]::ReadAllBytes("$outputDir/favicon-32x32.png")

# Build ICO file structure manually
# ICO Header: reserved(2) + type(2=icon) + count(2)
$icoBytes = New-Object System.Collections.Generic.List[byte]
$icoBytes.AddRange([byte[]]@(0,0,1,0,1,0))  # reserved=0, type=1(icon), count=1

# Directory entry: w,h,colors,reserved,planes,bpp,size,offset
$w = 32; $h = 32
$size = $pngBytes.Length
$offset = 6 + 16  # header + 1 entry
$icoBytes.AddRange([byte[]]@($w, $h, 0, 0, 1, 0, 32, 0))  # 32bpp
$icoBytes.AddRange([bitconverter]::GetBytes($size))
$icoBytes.AddRange([bitconverter]::GetBytes($offset))

# Append the PNG data
$icoBytes.AddRange($pngBytes)

[System.IO.File]::WriteAllBytes($icoPath, $icoBytes.ToArray())
Write-Output "Created: $icoPath (32x32 PNG wrapped in ICO)"

$srcImg.Dispose()
Write-Output "Done - all favicon sizes generated"
