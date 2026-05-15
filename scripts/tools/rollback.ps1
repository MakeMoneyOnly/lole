<#
.SYNOPSIS
    lole Rollback Script - Windows PowerShell

.DESCRIPTION
    Local script to rollback Vercel deployments.
    Requires Vercel CLI to be installed: npm i -g vercel

.PARAMETER Environment
    Target environment (production, staging). Default: production

.PARAMETER Type
    Rollback type: previous, deployment_id, versions_back. Default: previous

.PARAMETER DeploymentId
    Deployment ID (required for deployment_id type)

.PARAMETER VersionsBack
    Number of versions back. Default: 1

.PARAMETER Reason
    Reason for rollback. Default: Manual rollback via CLI

.PARAMETER SkipConfirm
    Skip confirmation prompt

.EXAMPLE
    .\rollback.ps1

.EXAMPLE
    .\rollback.ps1 -Environment staging

.EXAMPLE
    .\rollback.ps1 -Type deployment_id -DeploymentId dpl_xxxxx

.EXAMPLE
    .\rollback.ps1 -Type versions_back -VersionsBack 2
#>

param(
    [Parameter()]
    [ValidateSet("production", "staging")]
    [string]$Environment = "production",

    [Parameter()]
    [ValidateSet("previous", "deployment_id", "versions_back")]
    [string]$Type = "previous",

    [Parameter()]
    [string]$DeploymentId = "",

    [Parameter()]
    [int]$VersionsBack = 1,

    [Parameter()]
    [string]$Reason = "Manual rollback via CLI",

    [Parameter()]
    [switch]$SkipConfirm
)

# Configuration
$ProjectNames = @{
    "production" = "lole"
    "staging" = "lole-staging"
}

# Colors for output
function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    $colors = @{
        "Red" = [ConsoleColor]::Red
        "Green" = [ConsoleColor]::Green
        "Yellow" = [ConsoleColor]::Yellow
        "Blue" = [ConsoleColor]::Blue
        "White" = [ConsoleColor]::White
    }
    Write-Host $Message -ForegroundColor $colors[$Color]
}

function Show-Help {
    @"
lole Rollback Script

Usage:
    .\rollback.ps1 [options]

Options:
    -Environment       Target environment (production, staging) [default: production]
    -Type              Rollback type: previous, deployment_id, versions_back [default: previous]
    -DeploymentId      Deployment ID (required for deployment_id type)
    -VersionsBack      Number of versions back [default: 1]
    -Reason            Reason for rollback [default: Manual rollback via CLI]
    -SkipConfirm       Skip confirmation prompt
    -Help              Show this help message

Examples:
    # Rollback to previous deployment (production)
    .\rollback.ps1

    # Rollback staging to previous
    .\rollback.ps1 -Environment staging

    # Rollback to specific deployment ID
    .\rollback.ps1 -Type deployment_id -DeploymentId dpl_xxxxx

    # Rollback 2 versions back
    .\rollback.ps1 -Type versions_back -VersionsBack 2
"@
    exit 0
}

# Check if Vercel CLI is installed
function Test-VercelCLI {
    try {
        $null = Get-Command vercel -ErrorAction Stop
        return $true
    }
    catch {
        return $false
    }
}

# Check Vercel authentication
function Test-VercelAuth {
    try {
        $whoami = vercel whoami 2>&1
        if ($LASTEXITCODE -ne 0) {
            throw "Not authenticated"
        }
        return $whoami
    }
    catch {
        Write-ColorOutput "Error: Not logged in to Vercel. Run 'vercel login' first." -Color Red
        exit 1
    }
}

# Get deployments
function Get-Deployments {
    param([string]$ProjectName, [int]$Limit = 10)
    Write-ColorOutput "Fetching deployments for $ProjectName..." -Color Blue
    vercel list $ProjectName --limit $Limit
}

# Get current deployment
function Get-CurrentDeployment {
    param([string]$ProjectName)
    $deployments = vercel list $ProjectName --limit 5 2>&1
    $lines = $deployments -split "`n" | Where-Object { $_ -notmatch "Vercel CLI" -and $_ -notmatch "^$" -and $_ -notmatch "State" }
    $current = ($lines | Select-Object -Skip [Math]::Max(0, $lines.Count - 2) | Select-Object -First 1) -split '\s+' | Where-Object { $_ } | Select-Object -First 1
    return $current
}

# Get target deployment
function Get-TargetDeployment {
    param(
        [string]$ProjectName,
        [string]$Type,
        [int]$Versions,
        [string]$DeploymentId
    )

    switch ($Type) {
        "previous" {
            Write-ColorOutput "Finding previous deployment..." -Color Blue
            $deployments = vercel list $ProjectName --limit 5 2>&1
            $lines = $deployments -split "`n" | Where-Object { $_ -notmatch "Vercel CLI" -and $_ -notmatch "^$" -and $_ -notmatch "State" }
            $target = ($lines | Select-Object -Skip [Math]::Max(0, $lines.Count - 2) | Select-Object -First 1) -split '\s+' | Where-Object { $_ } | Select-Object -First 1
            return $target
        }
        "deployment_id" {
            if ([string]::IsNullOrEmpty($DeploymentId)) {
                Write-ColorOutput "Error: Deployment ID is required for deployment_id rollback type" -Color Red
                exit 1
            }
            return $DeploymentId
        }
        "versions_back" {
            Write-ColorOutput "Finding deployment $Versions versions back..." -Color Blue
            $deployments = vercel list $ProjectName --limit ($Versions + 2) 2>&1
            $lines = $deployments -split "`n" | Where-Object { $_ -notmatch "Vercel CLI" -and $_ -notmatch "^$" -and $_ -notmatch "State" }
            $target = ($lines | Select-Object -Skip [Math]::Max(0, $lines.Count - 1 - $Versions) | Select-Object -First 1) -split '\s+' | Where-Object { $_ } | Select-Object -First 1
            return $target
        }
    }
}

# Main script execution
Write-ColorOutput "=== lole Rollback Script ===" -Color Blue
Write-Host ""

# Validate inputs
if (-not $ProjectNames.ContainsKey($Environment)) {
    Write-ColorOutput "Error: Invalid environment: $Environment" -Color Red
    Write-ColorOutput "Valid environments: production, staging" -Color Red
    exit 1
}

if ($Type -eq "deployment_id" -and [string]::IsNullOrEmpty($DeploymentId)) {
    Write-ColorOutput "Error: Deployment ID is required for deployment_id rollback type" -Color Red
    exit 1
}

$ProjectName = $ProjectNames[$Environment]

# Check prerequisites
if (-not (Test-VercelCLI)) {
    Write-ColorOutput "Error: Vercel CLI is not installed. Install it with: npm i -g vercel" -Color Red
    exit 1
}

$whoami = Test-VercelAuth
Write-ColorOutput "Authenticated as: $whoami" -Color Green
Write-Host ""

# Get deployments
Write-ColorOutput "=== Current Deployments ===" -Color Blue
Get-Deployments -ProjectName $ProjectName

# Get current and target deployments
$CurrentDeployment = Get-CurrentDeployment -ProjectName $ProjectName
Write-ColorOutput "Current deployment: $CurrentDeployment" -Color Blue

$TargetDeployment = Get-TargetDeployment -ProjectName $ProjectName -Type $Type -Versions $VersionsBack -DeploymentId $DeploymentId
Write-ColorOutput "Target deployment: $TargetDeployment" -Color Blue

# Confirm rollback
if (-not $SkipConfirm) {
    Write-Host ""
    Write-ColorOutput "You are about to rollback:" -Color Yellow
    Write-Host "  Project:      $ProjectName"
    Write-Host "  Environment:  $Environment"
    Write-Host "  Rollback to:  $TargetDeployment"
    Write-Host "  Current:      $CurrentDeployment"
    Write-Host "  Reason:       $Reason"
    Write-Host ""

    $confirm = Read-Host "Are you sure you want to proceed? (y/N)"
    if ($confirm -ne "y" -and $confirm -ne "Y") {
        Write-ColorOutput "Rollback cancelled." -Color Blue
        exit 0
    }
}

# Perform rollback
Write-Host ""
Write-ColorOutput "=== Executing Rollback ===" -Color Blue
Write-ColorOutput "Performing rollback to $TargetDeployment..." -Color Blue

$output = vercel rollback $ProjectName $TargetDeployment --yes 2>&1
$exitCode = $LASTEXITCODE

Write-Host $output

if ($exitCode -eq 0) {
    Write-ColorOutput "Rollback initiated successfully!" -Color Green
    Write-Host ""
    Write-Host "The deployment will be promoted to production shortly."
    Write-Host "You can monitor the progress in the Vercel dashboard."
}
else {
    Write-ColorOutput "Rollback failed with exit code: $exitCode" -Color Red
    exit 1
}

# Wait and show status
Write-Host ""
Write-ColorOutput "Waiting for deployment to become ready..." -Color Blue
Start-Sleep -Seconds 5

Write-Host ""
Write-ColorOutput "=== Rollback Complete ===" -Color Green
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Verify the application is working correctly"
Write-Host "  2. Check the Vercel dashboard for deployment status"
Write-Host "  3. Monitor for any issues in Sentry/logs"
Write-Host ""
Write-Host "If issues persist, you can rollback again to an earlier version."
