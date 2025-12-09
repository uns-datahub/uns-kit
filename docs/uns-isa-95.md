## UNS structure (ISA‑95 aligned)

### Topic shape

```
<Enterprise>/<Site>/<Area>/<Line>/<Asset>/<ObjectType>/<ObjectId>/<Attribute>
```

---

### Example topics

#### Equipment temperature
```
acme/plant-a/hot-end/line-1/furnace-1/equipment/main/measured-temperature
```

| Segment    | Value           | Description (ISA‑95)                |
| ---------- | --------------- | ----------------------------------- |
| Enterprise | `acme`          | Enterprise                          |
| Site       | `plant-a`       | Site                                |
| Area       | `hot-end`       | Area                                |
| Line       | `line-1`        | Production line                     |
| Asset      | `furnace-1`     | Equipment                           |
| ObjectType | `equipment`     | Object type                         |
| ObjectId   | `main`          | Entity identifier (default)         |
| Attribute  | `measured-temperature` | Current measured temperature  |

#### Material lot
```
acme/plant-a/hot-end/line-1/furnace-1/material/main/lot
```

| Segment    | Value       | Description (ISA‑95)     |
| ---------- | ----------- | ------------------------ |
| Enterprise | `acme`      | Enterprise               |
| Site       | `plant-a`   | Site                     |
| Area       | `hot-end`   | Area                     |
| Line       | `line-1`    | Production line          |
| Asset      | `furnace-1` | Equipment                |
| ObjectType | `material`  | Object type              |
| ObjectId   | `main`      | Entity identifier        |
| Attribute  | `lot`       | Active lot on equipment  |

#### Personnel task
```
acme/plant-a/hot-end/line-1/cabin-1/personnel/alex/assigned-task
```

| Segment    | Value         | Description (ISA‑95)   |
| ---------- | ------------- | ---------------------- |
| Enterprise | `acme`        | Enterprise             |
| Site       | `plant-a`     | Site                   |
| Area       | `hot-end`     | Area                   |
| Line       | `line-1`      | Production line        |
| Asset      | `cabin-1`     | Work cell / equipment  |
| ObjectType | `personnel`   | Object type            |
| ObjectId   | `alex`        | Person identifier      |
| Attribute  | `assigned-task` | Current assigned task |

#### Specific sensor on equipment
```
acme/plant-a/hot-end/line-1/furnace-1/equipment/sensor-23/measured-vibration
```

| Segment    | Value               | Description (ISA‑95)      |
| ---------- | ------------------- | ------------------------- |
| Enterprise | `acme`              | Enterprise                |
| Site       | `plant-a`           | Site                      |
| Area       | `hot-end`           | Area                      |
| Line       | `line-1`            | Production line           |
| Asset      | `furnace-1`         | Equipment                 |
| ObjectType | `equipment`         | Object type               |
| ObjectId   | `sensor-23`         | Sensor on equipment       |
| Attribute  | `measured-vibration` | Current measured vibration |

---

### Recommended object types (ISA‑95 aligned)

Use these values for the `ObjectType` segment:

- `equipment` – machines, furnaces, sensors; attributes: `status`, `temperature`, `vibration`, `operating-hours`, `fault-code`, `speed`, `energy-consumption`
- `material` – lots/batches/raw materials; attributes: `lot-id`, `batch-number`, `material-type`, `quantity`, `location`, `status`
- `personnel` – operators/supervisors/technologists; attributes: `presence`, `status`, `task-id`, `role`, `authorization-level`
- `process-segment` – process steps (e.g., rolling, cooling); attributes: `start-time`, `end-time`, `status`, `duration`, `output-quantity`, `operator-id`
- `product-definition` – product specs/recipes; attributes: `product-code`, `revision`, `specification`, `target-parameters`, `material-composition`, `version-history`
- `product-quality` – quality indicators; attributes: `inspection-result`, `deviation`, `pass-fail`, `surface-defect`, `hardness`, `tensile-strength`
- `work-definition` – task/workflow definitions; attributes: `work-order-id`, `task-list`, `planned-start`, `planned-end`, `assigned-to`, `instruction-url`
- `resource-status` – status of any resource (material/personnel/equipment); attributes: `availability`, `utilization`, `downtime`, `status`, `maintenance-status`
- `energy-resource` – energy carriers (electricity/steam/gas); attributes: `power`, `energy`, `voltage`, `current`, `frequency`, `cost`
- `utility-resource` – utilities (water/air/nitrogen/etc.); attributes: `pressure`, `flow`, `consumption`, `status`, `alarm`
- `fluid-resource` – fluids and gases (non-energy); attributes: `flow`, `pressure`, `temperature`, `total-flow`, `conductivity`, `ph`
- `consumable-resource` – consumables (lubricants/cleaners); attributes: `level`, `consumption-rate`, `refill-required`, `last-refill`, `status`

---

### Conventions

- `Line` represents a physical production unit (ISA‑95: Work Unit); `Asset` is equipment inside it.
- `ObjectType` should use the list above; `ObjectId` is a unique identifier (use `main` when none exists).
- `Attribute` is always the final segment, preferably in `kebab-case` (e.g., `measured-temperature`, `status-code`, `quality-score`).
- Prefix segments (`Enterprise/Site/Area/Line/Asset`) are flexible to fit your hierarchy.

This convention enables consistent parsing, controller validation, topic-tree building, and downstream storage (e.g., QuestDB/Postgres) without brittle string guessing.
