$ErrorActionPreference = 'Stop'

param(
  [string]$ProjectRef,
  [switch]$SkipSecrets
)

function Invoke-Supabase {
  param([string[]]$Args)

  & npx supabase @Args
  if ($LASTEXITCODE -ne 0) {
    throw "Supabase CLI command failed: npx supabase $($Args -join ' ')"
  }
}

Write-Host "Deploying Supabase Edge Function: user-admin" -ForegroundColor Cyan

if (-not (Get-Command npx -ErrorAction SilentlyContinue)) {
  throw "npx is required to deploy the Edge Function."
}

$projectArgs = @()
if ($ProjectRef) {
  $projectArgs = @('--project-ref', $ProjectRef)
}

if (-not $SkipSecrets) {
  if (-not $env:SUPABASE_SERVICE_ROLE_KEY) {
    throw "Set SUPABASE_SERVICE_ROLE_KEY in your shell first, or re-run with -SkipSecrets if the secret is already configured in Supabase."
  }

  Write-Host "Syncing SUPABASE_SERVICE_ROLE_KEY secret..." -ForegroundColor Yellow
  Invoke-Supabase -Args @('secrets', 'set', "SUPABASE_SERVICE_ROLE_KEY=$env:SUPABASE_SERVICE_ROLE_KEY") + $projectArgs
}

Write-Host "Deploying function..." -ForegroundColor Yellow
Invoke-Supabase -Args @('functions', 'deploy', 'user-admin') + $projectArgs

Write-Host ""
Write-Host "Deployment complete." -ForegroundColor Green
Write-Host "Next steps:" -ForegroundColor Green
Write-Host "1. Confirm your project is linked or pass -ProjectRef <ref>."
Write-Host "2. In Supabase, verify the function has access to SUPABASE_SERVICE_ROLE_KEY."
Write-Host "3. Test the Users page with an authenticated admin account."
