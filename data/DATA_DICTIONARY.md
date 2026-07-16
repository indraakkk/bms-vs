# Data Dictionary

Complete field definitions for all CSV data sources.

---

## 1. energy_consumption.csv

Hourly energy metering readings from SCADA and Modbus-connected meters across both buildings.

| Column | Type | Unit | Description | Example |
|--------|------|------|-------------|---------|
| `timestamp` | datetime | — | Reading timestamp (ISO 8601) | `2025-06-01 08:00:00` |
| `building_id` | string | — | Building identifier | `BLD-001` |
| `floor` | integer | — | Floor number | `1` |
| `zone` | string | — | Zone identifier within floor | `Zone-A` |
| `device_type` | string | — | Category of device | `HVAC`, `Lighting`, `UPS`, `Server Room`, `Elevator` |
| `device_id` | string | — | Unique device identifier | `HVAC-A1-01` |
| `energy_kwh` | float | kWh | Energy consumed in the hour | `56.2` |
| `power_kw` | float | kW | Average power draw during the hour | `22.5` |
| `voltage_v` | float | V | Average supply voltage | `220.3` |
| `current_a` | float | A | Average current draw | `102.1` |
| `power_factor` | float | — | Power factor (0–1 scale) | `0.89` |
| `cost_usd` | float | USD | Estimated cost for the hour | `6.74` |
| `source_system` | string | — | Data acquisition system | `SCADA` or `Modbus` |

### Key Relationships

- `building_id` + `floor` + `zone` → maps to a physical area
- `device_id` → unique per device, `device_type` categorizes it
- `cost_usd ≈ energy_kwh × 0.12` (approximate tariff rate)

---

## 2. hvac_performance.csv

Hourly telemetry from air handling units (AHUs) and computer room air conditioning (CRAC) units.

| Column | Type | Unit | Description | Example |
|--------|------|------|-------------|---------|
| `timestamp` | datetime | — | Reading timestamp (ISO 8601) | `2025-06-01 08:00:00` |
| `building_id` | string | — | Building identifier | `BLD-001` |
| `floor` | integer | — | Floor number | `2` |
| `zone` | string | — | Zone identifier | `Zone-C` |
| `unit_id` | string | — | HVAC unit identifier | `CRAC-A2-01` |
| `mode` | string | — | Operating mode | `Cooling` |
| `setpoint_temp_c` | float | °C | Target temperature | `18.0` |
| `actual_temp_c` | float | °C | Measured temperature | `18.3` |
| `outdoor_temp_c` | float | °C | Outdoor ambient temperature | `28.5` |
| `humidity_percent` | float | % | Relative humidity | `45` |
| `airflow_m3h` | float | m³/h | Airflow rate | `4500` |
| `filter_status_percent` | float | % | Filter remaining life (100 = new) | `92` |
| `compressor_hours` | float | hours | Cumulative compressor runtime | `8900` |
| `energy_efficiency_ratio` | float | — | EER (higher = more efficient) | `3.8` |
| `operating_status` | string | — | Current operational state | `Running`, `Idle`, `Fault` |

### Key Relationships

- `setpoint_temp_c` vs `actual_temp_c` → HVAC performance gap
- `filter_status_percent` < 60 → triggers maintenance alerts
- `energy_efficiency_ratio` → lower values indicate degraded performance

---

## 3. occupancy.csv

Hourly occupancy counts and environmental quality readings per zone, from people-counting sensors and indoor air quality monitors.

| Column | Type | Unit | Description | Example |
|--------|------|------|-------------|---------|
| `timestamp` | datetime | — | Reading timestamp (ISO 8601) | `2025-06-01 08:00:00` |
| `building_id` | string | — | Building identifier | `BLD-001` |
| `floor` | integer | — | Floor number | `1` |
| `zone` | string | — | Zone identifier | `Zone-A` |
| `zone_capacity` | integer | persons | Maximum zone capacity | `150` |
| `person_count` | integer | persons | Current occupants | `120` |
| `occupancy_rate_percent` | float | % | Occupancy as % of capacity | `80.0` |
| `co2_ppm` | integer | ppm | CO₂ concentration | `780` |
| `temperature_c` | float | °C | Zone temperature | `25.2` |
| `humidity_percent` | float | % | Relative humidity | `62` |
| `air_quality_index` | integer | 0–100 | Composite AQI score (100 = best) | `58` |
| `entry_count` | integer | — | Entries in the past hour | `45` |
| `exit_count` | integer | — | Exits in the past hour | `5` |

### Key Relationships

- `person_count / zone_capacity` → should match `occupancy_rate_percent`
- `co2_ppm` > 800 → ventilation concern
- `air_quality_index` < 60 → poor air quality, correlate with `co2_ppm`
- `entry_count - exit_count` ≈ net change in `person_count` from previous hour

---

## 4. alerts_events.csv

System-generated alerts, alarms, and operational events from various BMS subsystems.

| Column | Type | Unit | Description | Example |
|--------|------|------|-------------|---------|
| `timestamp` | datetime | — | Alert trigger time (ISO 8601) | `2025-06-01 08:05:00` |
| `building_id` | string | — | Building identifier | `BLD-002` |
| `floor` | integer | — | Floor number | `1` |
| `zone` | string | — | Zone identifier | `Zone-A` |
| `alert_id` | string | — | Unique alert identifier | `ALT-0005` |
| `severity` | string | — | Alert severity level | `Critical`, `Warning`, `Info` |
| `category` | string | — | Alert category | `Environmental`, `Energy`, `Security`, `Equipment`, `Fire`, `Occupancy` |
| `device_id` | string | — | Associated device (if applicable) | `AHU-B1-01` |
| `alarm_type` | string | — | Specific alarm type | `HighCO2`, `HighTemperature`, etc. |
| `description` | string | — | Human-readable description | `CO2 levels in zone exceeded 800ppm` |
| `value` | float | varies | Measured value that triggered alert | `820` |
| `threshold` | float | varies | Threshold that was exceeded | `800` |
| `unit` | string | varies | Unit of the value/threshold | `ppm`, `degC`, `kWh`, etc. |
| `duration_minutes` | integer | min | How long the condition persisted | `45` |
| `resolved_at` | datetime | — | Resolution timestamp (empty if unresolved) | `2025-06-01 08:50:00` |
| `status` | string | — | Current status | `Resolved`, `Active`, `Open` |
| `acknowledged_by` | string | — | Person who acknowledged the alert | `John`, `Maria`, `Ops`, `Security` |

### Key Relationships

- `severity` determines UI color: **Critical** → red, **Warning** → orange, **Info** → blue
- `status = "Resolved"` + `resolved_at` → indicates resolved alerts
- `value` vs `threshold` → shows how much the threshold was exceeded
- `category` groups alerts for filtering

---

## Cross-File Relationships

```
energy_consumption         hvac_performance           occupancy
├── building_id            ├── building_id            ├── building_id
├── floor                  ├── floor                  ├── floor
├── zone                   ├── zone                   ├── zone
├── device_type            ├── unit_id                ├── zone_capacity
├── device_id              └── device_id              ├── person_count
│                                                    └── co2_ppm
alerts_events
├── building_id
├── floor
├── zone
├── device_id              ← links to energy.device_id or hvac.unit_id
└── category               ← determines subsystem
```

All four files can be joined on `building_id + floor + zone` for cross-source analysis.

---

## Data Characteristics

| Property | Value |
|----------|-------|
| **Date range** | 2025-06-01 (single day, hourly) |
| **Buildings** | 2 (`BLD-001`, `BLD-002`) |
| **Floors per building** | 2 (Floor 1, Floor 2) |
| **Zones per floor** | 2–3 (`Zone-A`, `Zone-B`, `Zone-C`) |
| **Total energy records** | ~80 |
| **Total HVAC records** | ~35 |
| **Total occupancy records** | ~63 |
| **Total alert records** | 20 |
| **Time granularity** | 1 hour |
| **Missing data** | None (all fields populated) |
