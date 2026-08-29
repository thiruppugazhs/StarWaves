# Pull on VM via gcloud from Windows PC
# Run on PC:  .\scripts\vm-pull.ps1 -VmHost personal-vm -Tag latest
param(
  [string]$VmHost = "personal-vm",
  [string]$VmZone = "us-central1-a",
  [string]$Tag = "latest"
)
$ErrorActionPreference = "Stop"
$cmd = "TAG=$Tag bash ~/starwaves/scripts/vm-pull.sh"
gcloud compute ssh $VmHost --zone=$VmZone --command="$cmd"
