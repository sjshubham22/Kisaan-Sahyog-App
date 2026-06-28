const ALERT_THRESHOLDS = {
  heatwave: {
    field: 'temperature_2m_max',
    operator: '>',
    value: 40,
    consecutive_days: 2,
    severity: 'HIGH',
    alert_type: 'Heatwave',
    action_template: 'Provide extra irrigation to crops. Keep cattle and livestock in shaded, well-ventilated shelters with plenty of clean drinking water.'
  },
  heavy_rain: {
    field: 'precipitation_sum',
    operator: '>',
    value: 50,
    severity: 'HIGH',
    alert_type: 'Heavy Rainfall',
    action_template: 'Ensure proper drainage in low-lying fields to prevent waterlogging. Delay any planned fertiliser or pesticide spraying.'
  },
  storm: {
    field: 'windspeed_10m_max',
    operator: '>',
    value: 60,
    severity: 'EXTREME',
    alert_type: 'Severe Storm',
    action_template: 'Secure crop supports, plastic tunnels, and farm equipment. Delay harvesting until the storm passes. Stay indoors.'
  },
  frost: {
    field: 'temperature_2m_min',
    operator: '<',
    value: 4,
    severity: 'HIGH',
    alert_type: 'Frost Risk',
    action_template: 'Cover sensitive seedlings or young crops. Apply light evening irrigation to raise soil temperature.'
  },
  drought_risk: {
    field: 'precipitation_sum',
    operator: '<',
    value: 2,
    consecutive_days: 7,
    severity: 'MEDIUM',
    alert_type: 'Drought Risk',
    action_template: 'Minimize evapotranspiration loss. Practice weeding to conserve soil moisture and plan micro-irrigation/drip scheduling.'
  }
};

/**
 * Checks if a rule is triggered by the forecast data.
 * @param {Array<number>} values - Forecasted daily values for a specific field
 * @param {object} rule - Threshold rule definition
 * @returns {boolean} - True if rule conditions are met
 */
function ruleMatches(values, rule) {
  if (!values || !Array.isArray(values) || values.length === 0) {
    return false;
  }

  const op = rule.operator;
  const limit = rule.value;
  const consecutiveNeeded = rule.consecutive_days || 1;

  let consecutiveCount = 0;

  for (let val of values) {
    let matches = false;
    if (val !== null && val !== undefined) {
      if (op === '>') matches = val > limit;
      else if (op === '<') matches = val < limit;
      else if (op === '>=') matches = val >= limit;
      else if (op === '<=') matches = val <= limit;
    }

    if (matches) {
      consecutiveCount++;
      if (consecutiveCount >= consecutiveNeeded) {
        return true;
      }
    } else {
      consecutiveCount = 0; // Reset consecutive run
    }
  }

  return false;
}

/**
 * Evaluates the rules engine against an Open-Meteo forecast object.
 * @param {object} forecast - Open-Meteo API response containing daily forecast data
 * @returns {Array<object>} - List of triggered alert definitions
 */
function evaluateThresholds(forecast) {
  const triggered = [];
  if (!forecast || !forecast.daily) {
    return triggered;
  }

  for (const [name, rule] of Object.entries(ALERT_THRESHOLDS)) {
    const dailyValues = forecast.daily[rule.field];
    if (ruleMatches(dailyValues, rule)) {
      triggered.push({
        rule_name: name,
        alert_type: rule.alert_type,
        severity: rule.severity,
        recommended_action: rule.action_template,
        field_checked: rule.field,
        threshold_value: rule.value
      });
    }
  }

  return triggered;
}

module.exports = {
  ALERT_THRESHOLDS,
  evaluateThresholds
};
