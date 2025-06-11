
from github import Github
import json
import os
from datetime import datetime, timedelta

REPOS = [
    "IBM-Cloud/terraform-provider-ibm",
    "IBM/vpc-go-sdk",
    "IBM/vpc-python-sdk",
    "IBM/vpc-node-sdk",
    "IBM/vpc-ruby-sdk",
    "IBM/vpc-java-sdk",
    "IBM/vpc-beta-go-sdk",
    "IBM/packer-plugin-ibmcloud",
    "ibm-vpc/terraform-provider-ibm"
]

TOKEN = os.getenv("GITHUB_TOKEN")
g = Github(TOKEN)

since = datetime.utcnow() - timedelta(hours=1)

issues_summary = []
prs_summary = []

for repo_name in REPOS:
    repo = g.get_repo(repo_name)
    issues = repo.get_issues(state='open', since=since)
    for issue in issues:
        if issue.pull_request is None:
            issues_summary.append({
                "repo": repo_name,
                "title": issue.title,
                "url": issue.html_url,
                "user": issue.user.login,
                "created_at": issue.created_at.isoformat(),
                "body": (issue.body or "").strip()[:300] + "..."
            })
    
    pulls = repo.get_pulls(state='open', sort='updated', direction='desc')
    for pr in pulls:
        if pr.created_at > since:
            prs_summary.append({
                "repo": repo_name,
                "title": pr.title,
                "url": pr.html_url,
                "user": pr.user.login,
                "created_at": pr.created_at.isoformat(),
                "body": (pr.body or "").strip()[:300] + "..."
            })

with open("data/issues.json", "w") as f:
    json.dump(issues_summary, f, indent=2)

with open("data/prs.json", "w") as f:
    json.dump(prs_summary, f, indent=2)
