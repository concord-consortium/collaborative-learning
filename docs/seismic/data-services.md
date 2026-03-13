# Seismic Data Services

Notes on the two FDSN-compatible data services we evaluated. We chose EarthScope for classroom use — see [seismic-tiles-plan.md](seismic-tiles-plan.md) for context.

Neither service supports CORS, so a proxy is required for browser access.

Both services use the miniSEED binary format, which can be processed by libraries such as [seisplotjs](https://github.com/crotwell/seisplotjs). That library can handle multiple chunks of data if requests need to be broken up.

## EarthScope (formerly IRIS)

**Chosen for classroom use.**

### Accessing data

Data is accessed via FDSN URLs. Example for the Anchorage airport station:

```
https://service.earthscope.org/fdsnws/dataselect/1/query?net=AK&sta=K204&loc=--&cha=HNZ&start=2026-02-01T00:00:00&end=2026-02-02T00:00:00
```

Figuring out the correct URL parameters (network, station, location, channel) can be tricky — you need more than just the station code. There is a station metadata service that helps, though you need the station code and network (probably all `AK` for our stations):

```
https://service.earthscope.org/fdsnws/station/1/query?net=AK&sta=K204&level=channel&format=text
```

### File sizes

Significantly larger than Raspberry Shake (likely higher sample rate):

| Duration | Size |
|----------|------|
| 5 minutes | 97 KB |
| 1 hour | 940 KB |
| 24 hours | 21–28 MB |

### Rate limits

Described at https://ds.iris.edu/ds/nodes/dmc/services/usage/

- 5 concurrent connections max
- 10 connections per second max
- Connections denied if limits exceeded

They recommend limiting requests to 24 hours but don't enforce a hard limit. Their main concern is people trying to get real-time data — they have a separate streaming service for that.

### Redistribution policy

From the [IRIS data policy announcement](https://ds.iris.edu/ds/newsletter/vol18/no1/460/iris-board-approves-new-data-policies-for-iris/):

> The IRIS DMC encourages the redistribution of IRIS data to other interested parties without restriction.

The only requirement is that redistribution be documented according to their "Redistribution of IRIS Data" guidelines. However, we were unable to locate this guidelines document — it may not have been migrated from the old IRIS site to the current EarthScope site. All data collected with NSF SAGE instrumentation are made freely and openly available.

## Raspberry Shake

**Not chosen** — does not allow redistribution of raw data, and rate limits are too low for classroom use.

### Accessing data

Data is accessed via FDSN URLs, similar to EarthScope:

```
https://data.raspberryshake.org/fdsnws/dataselect/1/query?net=AM&sta=R5661&loc=00&cha=SHZ&start=2017-06-20T20:00:00&end=2017-06-21T20:00:00
```

Only 24 hours of data can be fetched per request, so longer time spans must be broken up.

### File sizes

| Duration | Size |
|----------|------|
| 5 minutes | 34.5 KB |
| 1 hour | 400 KB |
| 24 hours | 8.3 MB |

### Rate limits

- 5 requests per second
- 30 requests per minute
- 200 MB to the same IP triggers a 500 KB/s download rate limit (time frame unclear)
- Exceeding limits results in a 429 error

These limits would be problematic with a whole class downloading simultaneously.

### Redistribution policy

From https://shop.raspberryshake.org/license/:

> **Redistribution of Legacy Data**
>
> It is strictly prohibited to redistribute Raspberry Shake waveform data obtained from https://data.raspberryshake.org/fdsnws/ via your own FDSN Web Service, data center or server (e.g., redistribution via services similar to IRIS's Federator or Wilber is not permitted)

### Why not chosen

- **No redistribution**: Raspberry Shake does not allow redistribution of raw data, which means we cannot proxy and cache data for classroom use.
- **Low rate limits**: The combination of per-second, per-minute, and bandwidth limits would quickly restrict a classroom of students.
