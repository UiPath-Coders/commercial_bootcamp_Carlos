# Lab 9 Step 4: public IP the organization sees

Read-only check on 2026-10-05, organization `customersuccessamer`, tenant `Training`. Step 4 is done.

| Check | Result |
|---|---|
| Command | `uip admin ip-restriction my-ip --output json` (uip 1.202.1) |
| Runs | 3, each returned `Result: Success` (`Code: ApmsMyIpGet`) |
| Public IP | **No IP returned** for this connection (`Data` was empty on every run) |

On some networks (VPN, proxy, IPv6), my-ip reports Success without an IP address. That is expected, so
the command was not retried.

No IP ranges, enforcement or bypass rules were listed or changed.
