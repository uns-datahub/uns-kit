export type MeasurementUnit = PhysicalMeasurements | DataSizeMeasurements | (string & {});

// Data Size
export enum DataSizeMeasurements {
  Bit = "bit",
  Byte = "B",
  KiloByte = "kB",
  MegaByte = "MB",
  GigaByte = "GB",
  TeraByte = "TB",
  PetaByte = "PB",
  ExaByte = "EB",
  ZettaByte = "ZB",
  YottaByte = "YB",
}

// Counter Measurements
export enum CounterMeasurements {
  Kilo = "k",
  Mega = "M",
  Giga = "G",
}

// Physical Measurements
export enum PhysicalMeasurements {
  None = "",
  // Length
  // -------------------------------------------------
  MiliMeter = "mm",
  Meter = "m",
  KiloMeter = "km",
  Feet = "ft",

  // Time
  // -------------------------------------------------
  Second = "s",
  Minute = "min",
  Hour = "h",
  Day = "day",

  // Frequency
  // -------------------------------------------------
  Hertz = "Hz",

  // Volume
  // -------------------------------------------------
  CubicMeter = "m^3",
  Liter = "l",
  Gallon = "gal",

  // Pressure
  // -------------------------------------------------
  Psi = "psi",
  Pascal = "Pa",
  Bar = "bar",

  // Temperature
  // -------------------------------------------------
  Celsius = "°C",
  Fahrenheit = "°F",
  Kelvin = "K",

  // Energy
  // -------------------------------------------------
  Milijoule = "mJ",
  Joule = "J",
  Kilojoule = "kJ",
  Megajoule = "MJ",
  Gigajoule = "GJ",
  Terajoule = "TJ",

  // Force
  // -------------------------------------------------
  Newton = "N",

  // Data
  // -------------------------------------------------
  Bit = "bit",
  Byte = "byte",
  B = "B",

  // Speed
  // -------------------------------------------------
  MilimeterPerSecond = "mm/s",
  MeterPerSecond = "m/s",
  MeterPerMinute = "m/min",
  CentiMeterPerSecond = "cm/s",
  MeterPerHour = "m/h",
  KilometerPerHour = "km/h",

  // Rotational Speed
  // -------------------------------------------------
  RevolutionsPerMinute = "rpm",

  // Percentage
  // -------------------------------------------------
  Percent = "percent",

  // Parts Per
  // -------------------------------------------------
  PartsPerMillion = "ppm",
  PartsPerBillion = "ppb",
  PartsPerTrillion = "ppt",

  // Other Angular Units
  // -------------------------------------------------
  Decibel = "dB",
  Degree = "°",
  Radian = "rad",

  // Mass
  // -------------------------------------------------
  Miligram = "mg",
  Gram = "g",
  Kilogram = "kg",
  MetricTon = "t",

  // Electric Potential
  // -------------------------------------------------
  MiliVolt = "mV",
  Volt = "V",
  KiloVolt = "kV",
  MegaVolt = "MV",

  // Electric Current
  // -------------------------------------------------
  MiliAmpere = "mA",
  Ampere = "A",
  KiloAmpere = "kA",
  MegaAmpere = "MA",

  // Power
  // -------------------------------------------------
  MiliWatt = "mW",
  Watt = "W",
  KiloWatt = "kW",
  MegaWatt = "MW",

  // Energy per unit time
  // -------------------------------------------------
  MiliWattHour = "mWh",
  WattHour = "Wh",
  KiloWattHour = "kWh",
  MegaWattHour = "MWh",

  // Apparent Power
  // -------------------------------------------------
  MiliVoltAmpere = "mVA",
  VoltAmpere = "VA",
  KiloVoltAmpere = "kVA",
  MegaVoltAmpere = "MVA",

  // Reactive Power
  // -------------------------------------------------
  MiliVoltAmpereReactive = "mVAR",
  VoltAmpereReactive = "VAR",
  KiloVoltAmpereReactive = "kVAR",
  MegaVoltAmpereReactive = "MVAR",

  // Flow Rates
  // -------------------------------------------------
  CubicMeterPerHour = "m^3/h",
  CubicMeterPerSecond = "m^3/s",


  // Other
  // -------------------------------------------------
  MegaGramPerHour = "Mg/h",
  MetricTonPerHour = "t/h",
}


