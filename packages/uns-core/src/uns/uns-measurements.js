// Data Size
export var DataSizeMeasurements;
(function (DataSizeMeasurements) {
    DataSizeMeasurements["Bit"] = "bit";
    DataSizeMeasurements["Byte"] = "B";
    DataSizeMeasurements["KiloByte"] = "kB";
    DataSizeMeasurements["MegaByte"] = "MB";
    DataSizeMeasurements["GigaByte"] = "GB";
    DataSizeMeasurements["TeraByte"] = "TB";
    DataSizeMeasurements["PetaByte"] = "PB";
    DataSizeMeasurements["ExaByte"] = "EB";
    DataSizeMeasurements["ZettaByte"] = "ZB";
    DataSizeMeasurements["YottaByte"] = "YB";
})(DataSizeMeasurements || (DataSizeMeasurements = {}));
// Counter Measurements
export var CounterMeasurements;
(function (CounterMeasurements) {
    CounterMeasurements["Kilo"] = "k";
    CounterMeasurements["Mega"] = "M";
    CounterMeasurements["Giga"] = "G";
})(CounterMeasurements || (CounterMeasurements = {}));
// Physical Measurements
export var PhysicalMeasurements;
(function (PhysicalMeasurements) {
    PhysicalMeasurements["None"] = "";
    // Length
    // -------------------------------------------------
    PhysicalMeasurements["MiliMeter"] = "mm";
    PhysicalMeasurements["Meter"] = "m";
    PhysicalMeasurements["KiloMeter"] = "km";
    PhysicalMeasurements["Feet"] = "ft";
    // Time
    // -------------------------------------------------
    PhysicalMeasurements["Second"] = "s";
    PhysicalMeasurements["Minute"] = "min";
    PhysicalMeasurements["Hour"] = "h";
    PhysicalMeasurements["Day"] = "day";
    // Frequency
    // -------------------------------------------------
    PhysicalMeasurements["Hertz"] = "Hz";
    // Volume
    // -------------------------------------------------
    PhysicalMeasurements["CubicMeter"] = "m^3";
    PhysicalMeasurements["Liter"] = "l";
    PhysicalMeasurements["Gallon"] = "gal";
    // Pressure
    // -------------------------------------------------
    PhysicalMeasurements["Psi"] = "psi";
    PhysicalMeasurements["Pascal"] = "Pa";
    PhysicalMeasurements["Bar"] = "bar";
    // Temperature
    // -------------------------------------------------
    PhysicalMeasurements["Celsius"] = "\u00B0C";
    PhysicalMeasurements["Fahrenheit"] = "\u00B0F";
    PhysicalMeasurements["Kelvin"] = "K";
    // Energy
    // -------------------------------------------------
    PhysicalMeasurements["Milijoule"] = "mJ";
    PhysicalMeasurements["Joule"] = "J";
    PhysicalMeasurements["Kilojoule"] = "kJ";
    PhysicalMeasurements["Megajoule"] = "MJ";
    PhysicalMeasurements["Gigajoule"] = "GJ";
    PhysicalMeasurements["Terajoule"] = "TJ";
    // Force
    // -------------------------------------------------
    PhysicalMeasurements["Newton"] = "N";
    // Data
    // -------------------------------------------------
    PhysicalMeasurements["Bit"] = "bit";
    PhysicalMeasurements["Byte"] = "byte";
    PhysicalMeasurements["B"] = "B";
    // Speed
    // -------------------------------------------------
    PhysicalMeasurements["MilimeterPerSecond"] = "mm/s";
    PhysicalMeasurements["MeterPerSecond"] = "m/s";
    PhysicalMeasurements["MeterPerMinute"] = "m/min";
    PhysicalMeasurements["CentiMeterPerSecond"] = "cm/s";
    PhysicalMeasurements["MeterPerHour"] = "m/h";
    PhysicalMeasurements["KilometerPerHour"] = "km/h";
    // Rotational Speed
    // -------------------------------------------------
    PhysicalMeasurements["RevolutionsPerMinute"] = "rpm";
    // Percentage
    // -------------------------------------------------
    PhysicalMeasurements["Percent"] = "percent";
    // Parts Per
    // -------------------------------------------------
    PhysicalMeasurements["PartsPerMillion"] = "ppm";
    PhysicalMeasurements["PartsPerBillion"] = "ppb";
    PhysicalMeasurements["PartsPerTrillion"] = "ppt";
    // Other Angular Units
    // -------------------------------------------------
    PhysicalMeasurements["Decibel"] = "dB";
    PhysicalMeasurements["Degree"] = "\u00B0";
    PhysicalMeasurements["Radian"] = "rad";
    // Mass
    // -------------------------------------------------
    PhysicalMeasurements["Miligram"] = "mg";
    PhysicalMeasurements["Gram"] = "g";
    PhysicalMeasurements["Kilogram"] = "kg";
    PhysicalMeasurements["MetricTon"] = "t";
    // Electric Potential
    // -------------------------------------------------
    PhysicalMeasurements["MiliVolt"] = "mV";
    PhysicalMeasurements["Volt"] = "V";
    PhysicalMeasurements["KiloVolt"] = "kV";
    PhysicalMeasurements["MegaVolt"] = "MV";
    // Electric Current
    // -------------------------------------------------
    PhysicalMeasurements["MiliAmpere"] = "mA";
    PhysicalMeasurements["Ampere"] = "A";
    PhysicalMeasurements["KiloAmpere"] = "kA";
    PhysicalMeasurements["MegaAmpere"] = "MA";
    // Power
    // -------------------------------------------------
    PhysicalMeasurements["MiliWatt"] = "mW";
    PhysicalMeasurements["Watt"] = "W";
    PhysicalMeasurements["KiloWatt"] = "kW";
    PhysicalMeasurements["MegaWatt"] = "MW";
    // Energy per unit time
    // -------------------------------------------------
    PhysicalMeasurements["MiliWattHour"] = "mWh";
    PhysicalMeasurements["WattHour"] = "Wh";
    PhysicalMeasurements["KiloWattHour"] = "kWh";
    PhysicalMeasurements["MegaWattHour"] = "MWh";
    // Apparent Power
    // -------------------------------------------------
    PhysicalMeasurements["MiliVoltAmpere"] = "mVA";
    PhysicalMeasurements["VoltAmpere"] = "VA";
    PhysicalMeasurements["KiloVoltAmpere"] = "kVA";
    PhysicalMeasurements["MegaVoltAmpere"] = "MVA";
    // Reactive Power
    // -------------------------------------------------
    PhysicalMeasurements["MiliVoltAmpereReactive"] = "mVAR";
    PhysicalMeasurements["VoltAmpereReactive"] = "VAR";
    PhysicalMeasurements["KiloVoltAmpereReactive"] = "kVAR";
    PhysicalMeasurements["MegaVoltAmpereReactive"] = "MVAR";
    // Flow Rates
    // -------------------------------------------------
    PhysicalMeasurements["CubicMeterPerHour"] = "m^3/h";
    PhysicalMeasurements["CubicMeterPerSecond"] = "m^3/s";
    // Other
    // -------------------------------------------------
    PhysicalMeasurements["MegaGramPerHour"] = "Mg/h";
    PhysicalMeasurements["MetricTonPerHour"] = "t/h";
})(PhysicalMeasurements || (PhysicalMeasurements = {}));
