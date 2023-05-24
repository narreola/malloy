/*
 * Copyright 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import * as lite from 'vega-lite';
import {DataColumn, Explore, Field} from '@malloydata/malloy';
import {HTMLChartRenderer} from './chart';
import {COUNTRY_CODES} from './country_codes';
import {formatTitle, getColorScale} from './utils';
import world from 'world-atlas/countries-110m.json';

export class HTMLCountryRenderer extends HTMLChartRenderer {
  private getRegionField(explore: Explore): Field {
    return explore.intrinsicFields[0];
  }

  private getColorField(explore: Explore): Field {
    return explore.intrinsicFields[1];
  }

  getDataValue(data: DataColumn): string | number | undefined {
    if (data.isNumber()) {
      return data.value;
    } else if (data.isString()) {
      if (data.field === this.getRegionField(data.field.parentExplore)) {
        const id = COUNTRY_CODES[data.value];
        if (id === undefined) {
          return undefined;
        }
        return id;
      } else {
        return data.value;
      }
    } else if (data.isNull()) {
      // ignore nulls
      return undefined;
    } else {
      throw new Error('Invalid field type for shape map.');
    }
  }

  getDataType(field: Field): 'ordinal' | 'quantitative' | 'nominal' {
    if (field.isAtomicField()) {
      if (field.isDate() || field.isTimestamp()) {
        return 'nominal';
      } else if (field.isString()) {
        if (field === this.getRegionField(field.parentExplore)) {
          return 'quantitative';
        } else {
          return 'nominal';
        }
      } else if (field.isNumber()) {
        return 'quantitative';
      }
    }
    throw new Error('Invalid field type for shape map.');
  }

  getVegaLiteSpec(data: DataColumn): lite.TopLevelSpec {
    if (data.isNull()) {
      throw new Error('Expected struct value not to be null.');
    }

    if (!data.isArray()) {
      throw new Error('Invalid data for shape map');
    }

    const regionField = this.getRegionField(data.field);
    const colorField = this.getColorField(data.field);

    const colorType = colorField ? this.getDataType(colorField) : undefined;

    const colorDef = {
      field: colorField.name,
      type: colorType,
      axis: {title: formatTitle(this.options, colorField.name)},
      scale: getColorScale(colorType, false),
    };

    const mapped = this.mapData(data).filter(
      row => row[regionField.name] !== undefined
    );

    return {
      ...this.getSize(),
      data: {values: mapped},
      projection: {type: 'mercator'},
      layer: [
        {
          data: {sphere: true},
          mark: {type: 'geoshape', fill: 'aliceblue'},
        },
        {
          data: {
            values: world,
            format: {
              type: 'topojson',
              feature: 'countries',
            },
          },
          mark: {
            type: 'geoshape',
            fill: 'mintcream',
            stroke: 'black',
          },
        },
        {
          transform: [
            {
              lookup: regionField.name,
              from: {
                data: {
                  values: world,
                  format: {
                    type: 'topojson',
                    feature: 'countries',
                  },
                },
                key: 'id',
              },
              as: 'geo',
            },
          ],
          mark: 'geoshape',
          encoding: {
            shape: {field: 'geo', type: 'geojson'},
            color: colorDef,
          },
        },
      ],
    };
  }
}
