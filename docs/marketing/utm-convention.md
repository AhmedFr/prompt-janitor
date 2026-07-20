# UTM convention — prelaunch traction test

Every social link uses: `utm_medium=social`, `utm_campaign=prelaunch`, and a
per-channel `utm_source`, so GA4 (G-RX37WJZFSQ) can attribute waitlist signups
per channel (Reports → Acquisition → Traffic acquisition; conversions =
`waitlist_submit`).

| Channel | Link to post |
|---|---|
| X / Twitter | https://promptjanitor.app/?utm_source=x&utm_medium=social&utm_campaign=prelaunch |
| LinkedIn | https://promptjanitor.app/?utm_source=linkedin&utm_medium=social&utm_campaign=prelaunch |
| Reddit | https://promptjanitor.app/?utm_source=reddit&utm_medium=social&utm_campaign=prelaunch |
| Hacker News | https://promptjanitor.app/?utm_source=hn&utm_medium=social&utm_campaign=prelaunch |

For blog-post shares, keep the same params on the post URL, e.g.
https://promptjanitor.app/blog/what-a-bad-prompt-actually-costs?utm_source=hn&utm_medium=social&utm_campaign=prelaunch

Waitlist `source` values (hero / pricing-free / pricing-pro / footer / blog-<slug>)
arrive in the owner-notification email subject and in GA4's waitlist_submit
event — UTM says where they came FROM, source says which CTA converted.
