import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';

function Grafico() {
  const svgMapRef = useRef(null); 
  const svgRadialRef = useRef(null);
  const svgMunicipalitiesRef = useRef(null);
  const tooltipRef = useRef(null); 
  const [departmentsData, setDepartmentsData] = useState(null); 
  const [selectedYear, setSelectedYear] = useState('2020'); 
  const [selectedMonth, setSelectedMonth] = useState('12');
  const [selectedMunicipio, setSelectedMunicipio] = useState(null);
  const [selectedMunicipioName, setSelectedMunicipioName] = useState(null);
  const [municipalitiesData, setMunicipalitiesData] = useState(null); 
  const [educationData, setEducationData] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState(null); 
  const [selectedDepartmentName, setSelectedDepartmentName] = useState(null); 

  const [educationCompleteData, setEducationCompleteData] = useState([]);
  const [selectedMunicipalitiesData, setSelectedMunicipalitiesData] = useState(null);
  const [indicadoresUnicos, setIndicadoresUnicos] = useState([]);
  const [years, setYears] = useState([]);
  const [months, setMonths] = useState([]);
  const legendRef = useRef(null); 
  const legendRefRadial = useRef(null);
  const svgLineRef = useRef(null); 



  // Cargar el GeoJSON de departamentos
  useEffect(() => {
    fetch('/Files/MGN_ANM_DPTOS.geojson')
      .then(response => {
        if (!response.ok) {
          throw new Error("Error en la respuesta de la red");
        }
        return response.json();
      })
      .then(data => {
        setDepartmentsData(data);
      })
      .catch(error => {
        console.error("Error al cargar el GeoJSON de departamentos:", error);
      });
  }, []);

  // Cargar el GeoJSON de municipios
  useEffect(() => {
    fetch('/Files/MGN_ANM_MPIOS.geojson')
      .then(response => {
        if (!response.ok) {
          throw new Error("Error en la respuesta de la red");
        }
        return response.json();
      })
      .then(data => {
        setMunicipalitiesData(data);
      })
      .catch(error => {
        console.error("Error al cargar el GeoJSON de municipios:", error);
      });
  }, []);

  // Cargar el archivo de educación
  useEffect(() => {
    d3.csv('/Files/TerriData_Dim4_clean.csv') 
      .then(data => {
        const groupedData = d3.rollup(
          data,
          v => d3.mean(v, d => +d['Dato Numérico']),
          d => +d['Código Entidad']
        );
        const formattedData = Array.from(groupedData, ([code, value]) => ({ code, value }));
        setEducationData(formattedData);
      })
      .catch(error => {
        console.error("Error al cargar el CSV:", error);
      });
  }, []);

  useEffect(() => {
    d3.csv('/Files/TerriData_Dim4_clean.csv')
      .then(data => {
        const filteredData = data.map(item => ({
            CodigoEntidad: +item["Código Entidad"],
            Indicador: item.Indicador,
            DatoNumerico: item["Dato Numérico"],
            Anio: item.Año,
            Mes: item.Mes
          }));

        const uniqueIndicators = obtenerIndicadoresUnicos(data);
        const uniqueYears = obtenerAniosUnicos(data);
        const uniqueMonths = obtenerMesesUnicos(data);

        setIndicadoresUnicos(uniqueIndicators);
        setYears(uniqueYears);
        setMonths(uniqueMonths);
        setEducationCompleteData(filteredData);
    })
      .catch(error => {
        console.error("Error al cargar el CSV:", error);
      });
  }, []);
  


// Dibujar mapa de colombia
  useEffect(() => {
    if (departmentsData && municipalitiesData && educationData.length) {
      const svgMap = d3.select(svgMapRef.current);
      const width = 700;
      const height = 700;
      svgMap.attr('width', width).attr('height', height);

      const projection = d3.geoMercator().fitSize([width, height], departmentsData);
      const pathGenerator = d3.geoPath().projection(projection);
      const educationMap = new Map(educationData.map(d => [d.code, d.value]));

      const departmentValues = municipalitiesData.features.reduce((acc, feature) => {
        const departmentCode = +feature.properties.DPTO_CCDGO;
        const municipalityCode = +feature.properties.MPIO_CDPMP;
        let value = educationMap.get(municipalityCode) || 0;

        if (!acc[departmentCode]) {
          acc[departmentCode] = { total: 0, count: 0 };
        }
      
        if (value > 0) {
          acc[departmentCode].total += value;
          acc[departmentCode].count += 1;
        }
      
        return acc;
      }, {});

      const departmentAverages = Object.entries(departmentValues).map(([code, { total, count }]) => ({
        code: +code,
        value: count > 0 ? total / count : 0
      }));

      const values = departmentAverages.map(d => d.value);
      const minValue = d3.min(values);
      const maxValue = d3.max(values);

      const colorScale = d3.scaleLinear()
        .domain([minValue, maxValue])
        .range(['red', 'green']);

      svgMap.selectAll('path')
        .data(departmentsData.features)
        .join('path')
        .attr('d', pathGenerator)
        .attr('fill', d => {
          const departmentCode = +d.properties.DPTO_CCDGO;
          const value = departmentAverages.find(avg => avg.code === departmentCode)?.value;
          return value ? colorScale(value) : 'lightgrey';
        })
        .attr('stroke', 'black')
        .on('click', (event, d) => {
          const departmentCode = +d.properties.DPTO_CCDGO;
          const deparmentName = d.properties.DPTO_CNMBR;

          setSelectedDepartment(departmentCode); 
          setSelectedDepartmentName(deparmentName.charAt(0).toUpperCase() + deparmentName.slice(1).toLowerCase()); 

          const municipalitiesInDepartment = municipalitiesData.features.filter(municipality => 
            +municipality.properties.DPTO_CCDGO === departmentCode
          );
          setSelectedMunicipalitiesData({ type: 'FeatureCollection', features: municipalitiesInDepartment }); 
          const svgRadial = d3.select(svgRadialRef.current); 
          const svgchart = d3.select(svgLineRef.current);
          const legendRef = d3.select(legendRefRadial.current);
          svgRadial.selectAll("*").remove();
          svgchart.selectAll("*").remove();
          legendRef.selectAll("*").remove();
        });
        const legendWidth = 300;
      const legendHeight = 20;
      const legendSvg = d3.select(legendRef.current)
        .attr('width', legendWidth)
        .attr('height', legendHeight + 40);

      const gradient = legendSvg.append('defs')
        .append('linearGradient')
        .attr('id', 'legend-gradient')
        .attr('x1', '0%')
        .attr('y1', '0%')
        .attr('x2', '100%')
        .attr('y2', '0%');

      gradient.append('stop')
        .attr('offset', '0%')
        .attr('stop-color', 'red');

      gradient.append('stop')
        .attr('offset', '100%')
        .attr('stop-color', 'green');

      legendSvg.append('rect')
        .attr('x', 0)
        .attr('y', 10)
        .attr('width', legendWidth)
        .attr('height', legendHeight)
        .style('fill', 'url(#legend-gradient)');

      legendSvg.append('text')
        .attr('x', 0)
        .attr('y', 50)
        .style('text-anchor', 'start')
        .text(minValue.toFixed(1));

      legendSvg.append('text')
        .attr('x', legendWidth)
        .attr('y', 50)
        .style('text-anchor', 'end')
        .text(maxValue.toFixed(1));

      legendSvg.append('text')
        .attr('x', legendWidth / 2)
        .attr('y', 50)
        .style('text-anchor', 'middle')
        .text("Calidad de Educación");
      const tooltip = d3.select(tooltipRef.current)
      .style('position', 'absolute')
      .style('visibility', 'hidden')
      .style('background', 'white')
      .style('padding', '5px')
      .style('border', '1px solid black')
      .style('border-radius', '5px')
      .style('pointer-events', 'none');

    svgMap.selectAll('path')
      .data(departmentsData.features)
      .join('path')
      .attr('d', pathGenerator)
      .attr('fill', d => {
        const departmentCode = +d.properties.DPTO_CCDGO;
        const value = departmentAverages.find(avg => avg.code === departmentCode)?.value;
        return value ? colorScale(value) : 'lightgrey';
      })
      .attr('stroke', 'black')
      .on('mouseover', (event, d) => {
        const departmentName = d.properties.DPTO_CNMBR; 
        tooltip.html(departmentName)
          .style('top', (event.pageY + 5) + 'px')
          .style('left', (event.pageX + 5) + 'px')
          .style('visibility', 'visible');
      })
      .on('mousemove', (event) => {
        tooltip.style('top', (event.pageY + 5) + 'px')
               .style('left', (event.pageX + 5) + 'px');
      })
      .on('mouseout', () => {
        tooltip.style('visibility', 'hidden');
      });
      
      
    }
    

  }, [departmentsData, municipalitiesData, educationData]);

// Dibujar el departamento con municipios cuando se haya elegido
useEffect(() => {
    if (selectedMunicipalitiesData) {
      const svgMunicipalities = d3.select(svgMunicipalitiesRef.current);
      const width = 400; 
      const height = 400; 
      svgMunicipalities.attr('width', width).attr('height', height);
  
      const projection = d3.geoMercator().fitSize([width, height], selectedMunicipalitiesData);
      const pathGenerator = d3.geoPath().projection(projection);
  
      const municipalitiesEducationMap = new Map(educationData.map(d => [d.code, d.value]));
  
      const municipalityValues = selectedMunicipalitiesData.features.map(feature => {
        const municipalityCode = +feature.properties.MPIO_CDPMP;
        const value = municipalitiesEducationMap.get(municipalityCode) || 0;
        return { code: municipalityCode, value };
      });
  
      const values = municipalityValues.map(d => d.value);
      const minValue = d3.min(values);
      const maxValue = d3.max(values);
  
      const colorScale = d3.scaleLinear()
        .domain([minValue, maxValue])
        .range(['red', 'green']);
  
      const paths = svgMunicipalities.selectAll('path')
        .data(selectedMunicipalitiesData.features, d => d.properties.MPIO_CDPMP); 
  
      paths.enter()
        .append('path')
        .attr('d', pathGenerator)
        .attr('fill', d => {
          const municipalityCode = +d.properties.MPIO_CDPMP;
          const value = municipalityValues.find(m => m.code === municipalityCode)?.value;
          return value ? colorScale(value) : 'lightgrey';
        })
        .attr('stroke', 'black')
        .on('click', (event, d) => {
            const municipalityCode2 = +d.properties.MPIO_CDPMP;
            const municiplatyName= d.properties.MPIO_CNMBR
            setSelectedMunicipio(municipalityCode2);
            setSelectedMunicipioName(municiplatyName.charAt(0).toUpperCase() + municiplatyName.slice(1).toLowerCase())
          })
        .on('mouseenter', (event, d) => {
          const municipalityName = d.properties.MPIO_CNMBR;
          tooltipRef.current.innerHTML = municipalityName;
          tooltipRef.current.style.visibility = 'visible';
          tooltipRef.current.style.left = `${event.pageX + 5}px`; 
          tooltipRef.current.style.top = `${event.pageY + 5}px`; 
        })
        .on('mousemove', (event) => {
          tooltipRef.current.style.left = `${event.pageX + 5}px`; 
          tooltipRef.current.style.top = `${event.pageY + 5}px`; 
        })
        .on('mouseleave', () => {
          tooltipRef.current.style.visibility = 'hidden'; 
        })
        .transition()
        .duration(800)
        .attr('fill-opacity', 0.7);
  
      paths.transition() 
        .duration(800)
        .attr('d', pathGenerator)
        .attr('fill', d => {
          const municipalityCode = +d.properties.MPIO_CDPMP;
          const value = municipalityValues.find(m => m.code === municipalityCode)?.value;
          return value ? colorScale(value) : 'lightgrey';
        });
  
      paths.exit()
        .transition()
        .duration(300)
        .attr('fill-opacity', 0)
        .remove(); 
    }
  }, [selectedMunicipio,selectedMunicipalitiesData, educationData]);
//Dibujar grafico Radial
  useEffect(() => {
    if (selectedMunicipio && educationCompleteData.length) {
      const svg = d3.select(svgRadialRef.current);
      const width = 400;
      const height = 350;
      svg.attr('width', width).attr('height', height);
  
      const radius = Math.min(width, height) / 2 - 40;
  
      const indicatorsData = educationCompleteData.filter(d =>
        d['CodigoEntidad'] === selectedMunicipio &&
        d['Anio'] === selectedYear &&
        d['Mes'] === selectedMonth
      ).sort((a, b) => b.DatoNumerico - a.DatoNumerico); 
  
  
      const uniqueIndicators = indicatorsData.map(d => d.Indicador);
  
     
      const colorScale = d3.scaleOrdinal()
        .domain(uniqueIndicators)
        .range(d3.schemeCategory10); 
  
      const angleScale = d3.scaleBand()
        .domain(uniqueIndicators)
        .range([0, 2 * Math.PI]);
  
      const valueScale = d3.scaleLinear()
        .domain([0, 100]) 
        .range([0, radius]);
  
      const arc = d3.arc()
        .innerRadius(0)
        .outerRadius(d => valueScale(Number(d.DatoNumerico))) 
        .startAngle(d => angleScale(d.Indicador))
        .endAngle(d => angleScale(d.Indicador) + angleScale.bandwidth());
  
      const tooltip = d3.select('#tooltip') 
        .style('position', 'absolute')
        .style('visibility', 'hidden')
        .style('background', 'lightgrey')
        .style('padding', '5px')
        .style('border-radius', '3px');
  
      svg.selectAll('path')
        .data(indicatorsData)
        .join('path')
        .attr('d', arc)
        .attr('transform', `translate(${width / 2}, ${height / 2})`)
        .attr('fill', d => colorScale(d.Indicador))
        .attr('stroke', 'black')
        .attr('opacity', 0.7)
        .on('mouseenter', (event, d) => {
          tooltip.html(`Indicador: ${d.DatoNumerico}`) 
            .style('visibility', 'visible');
          d3.select(event.target)
            .attr('fill', 'orange')
            .attr('opacity', 1);
        })
        .on('mousemove', (event) => {
          tooltip.style('top', (event.pageY + 5) + 'px')
            .style('left', (event.pageX + 5) + 'px');
        })
        .on('mouseleave', (event) => {
          tooltip.style('visibility', 'hidden');
          d3.select(event.target)
            .attr('fill', d => colorScale(d.Indicador))
            .attr('opacity', 0.7);
        });
  
      const legend = d3.select(legendRefRadial.current);
      legend.selectAll('*').remove(); 
  
      uniqueIndicators.forEach((indicator) => {
        const legendRow = legend.append('div')
          .style('display', 'inline-flex')
          .style('align-items', 'center')
          .style('margin-right', '10px');
  
        legendRow.append('div')
          .style('width', '20px')
          .style('height', '20px')
          .style('background-color', colorScale(indicator))
          .style('margin-right', '5px');
  
        legendRow.append('span')
          .text(indicator);
      });
    }
  }, [selectedMunicipio, selectedYear, selectedMonth, educationCompleteData]);

  useEffect(() => {
    if (selectedMunicipio && educationCompleteData.length) {
        const svg = d3.select(svgLineRef.current);
        const width = 900;
        const height = 390;
        const margin = { top: 40, right: 20, bottom: 60, left: 60 };

        const data = educationCompleteData.filter(d => d.CodigoEntidad === selectedMunicipio);
        if (data.length === 0) {
            console.warn("Sin datos para el municipio seleccionado.");
            return;
        }

        const x = d3.scaleLinear()
            .domain(d3.extent(data, d => d.Anio))
            .range([margin.left, width - margin.right]);

        const y = d3.scaleLinear()
            .domain([0, d3.max(data, d => d.DatoNumerico)+10]).nice()
            .range([height - margin.bottom, margin.top]);

        svg.selectAll("*").remove();
        svg.attr("width", width)
           .attr("height", height);

        svg.append("rect")
            .attr("width", width)
            .attr("height", height)
            .attr("fill", "#f9f9f9");

        const grid = svg.append("g").attr("class", "grid");
        grid.append("g")
            .attr("transform", `translate(0,${height - margin.bottom})`)
            .call(d3.axisBottom(x).ticks(10).tickSize(-height + margin.top + margin.bottom).tickFormat(''))
            .selectAll("line").attr("stroke", "#e0e0e0");
        grid.append("g")
            .attr("transform", `translate(${margin.left},0)`)
            .call(d3.axisLeft(y).ticks(10).tickSize(-width + margin.left + margin.right).tickFormat(''))
            .selectAll("line").attr("stroke", "#e0e0e0");

        svg.append("g")
            .attr("transform", `translate(0,${height - margin.bottom})`)
            .call(d3.axisBottom(x).ticks(10).tickSizeOuter(0))
            .attr("font-size", "12px");

        svg.append("g")
            .attr("transform", `translate(${margin.left},0)`)
            .call(d3.axisLeft(y).ticks(10))
            .attr("font-size", "12px")
            .call(g => g.append("text")
                .attr("x", -margin.left)
                .attr("y", 15)
                .attr("fill", "black")
                .attr("text-anchor", "start")
                .text("Indicador"));

        const indicators = Array.from(new Set(data.map(d => d.Indicador)));
        const colorScale = d3.scaleOrdinal(d3.schemeTableau10);

        const line = d3.line()
            .curve(d3.curveCatmullRom)
            .x(d => x(d.Anio))
            .y(d => y(d.DatoNumerico));

        const tooltip = d3.select("body").append("div")
            .attr("class", "tooltip")
            .style("position", "absolute")
            .style("visibility", "hidden")
            .style("background", "rgba(0, 0, 0, 0.7)")
            .style("color", "white")
            .style("padding", "8px")
            .style("border-radius", "4px")
            .style("font-size", "12px")
            .style("box-shadow", "2px 2px 5px rgba(0, 0, 0, 0.3)");

        indicators.forEach(indicator => {
            const indicatorData = data.filter(d => d.Indicador === indicator);
            const safeIndicatorName = indicator.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9-_]/g, '');

            const path = svg.append("path")
                .datum(indicatorData)
                .attr("fill", "none")
                .attr("stroke", colorScale(indicator))
                .attr("stroke-width", 2)
                .attr("class", "indicator-line")
                .attr("d", line)
                .on("mouseover", () => {
                    svg.selectAll(".indicator-line").attr("opacity", 0.2);
                    svg.selectAll(".indicator-point").attr("opacity", 0.2);
                    path.attr("opacity", 1);
                    svg.selectAll(`.point-${safeIndicatorName}`).attr("opacity", 1);
                })
                .on("mouseout", () => {
                    svg.selectAll(".indicator-line").attr("opacity", 1);
                    svg.selectAll(".indicator-point").attr("opacity", 1);
                });

            svg.selectAll(`.point-${safeIndicatorName}`)
                .data(indicatorData)
                .join("circle")
                .attr("class", `point-${safeIndicatorName} indicator-point`)
                .attr("cx", d => x(d.Anio))
                .attr("cy", d => y(d.DatoNumerico))
                .attr("r", 4)
                .attr("fill", colorScale(indicator))
                .on("mouseover", (event, d) => {
                    tooltip.html(`<strong>Indicador:</strong> ${indicator}<br><strong>Año:</strong> ${d.Anio}<br><strong>Valor:</strong> ${d.DatoNumerico}`)
                        .style("visibility", "visible");
                    d3.select(event.target).attr("r", 6);
                    svg.selectAll(".indicator-line").attr("opacity", 0.2);
                    svg.selectAll(".indicator-point").attr("opacity", 0.2);
                    path.attr("opacity", 1);
                    svg.selectAll(`.point-${safeIndicatorName}`).attr("opacity", 1);
                })
                .on("mousemove", (event) => {
                    tooltip.style("top", (event.pageY - 10) + "px")
                        .style("left", (event.pageX + 10) + "px");
                })
                .on("mouseout", (event) => {
                    tooltip.style("visibility", "hidden");
                    d3.select(event.target).attr("r", 4);
                    svg.selectAll(".indicator-line").attr("opacity", 1);
                    svg.selectAll(".indicator-point").attr("opacity", 1);
                });
        });

        svg.append("text")
            .attr("x", width / 2)
            .attr("y", margin.top / 2)
            .attr("text-anchor", "middle")
            .attr("font-size", "18px")
            .attr("font-weight", "bold")
            .text( "Gráfico de Líneas de Indicadores por Año de " + selectedMunicipioName );

        return () => tooltip.remove();
    }
}, [selectedMunicipio, educationCompleteData]);

  // JSX de retorno
  return (
    <div style={{ display: 'flex', width: '1600px', height: '900px' }}>
      <div style={{ marginRight: '10', width: '800px', height: '900px' }}>
        <h2>Mapa Coroplético de Calidad de Educación</h2>
        <svg ref={svgMapRef}></svg>
        <svg ref={legendRef}></svg>
        <div ref={tooltipRef}></div>
      </div>
      <div style={{ width: '1100px', height: '897px',  display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'center' }}>
          <div style={{ width: '450px', height: '500px', border: '3px solid black', margin: '10px', borderRadius: '20px' }}>
            <h4>Departamento seleccionado {selectedDepartmentName}</h4>
            <svg ref={svgMunicipalitiesRef}></svg>
          </div>
          <div style={{ width: '450px', height: '500px', border: '3px solid black', margin: '10px', borderRadius: '20px' }}>
            <label>Año:  </label>
            <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)}  style={{border: '1px solid #ccc', borderRadius: '5px',fontSize: '16px',backgroundColor: '#f9f9f9',transition: 'border-color 0.3s',outline: 'none',cursor: 'pointer'}} >
              <option value="">Seleccione un año</option>
              {years.map((year, index) => (
                <option key={index} value={year}>{year}</option>
              ))}
            </select>
            <label>  Mes:  </label>
            <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} style={{border: '1px solid #ccc', borderRadius: '5px',fontSize: '16px',backgroundColor: '#f9f9f9',transition: 'border-color 0.3s',outline: 'none',cursor: 'pointer'}}>
              <option value="">Seleccione un mes</option>
              {months.map((month, index) => (
                <option key={index} value={month}>{month}</option>
              ))}
            </select>
            <svg ref={svgRadialRef}></svg>
            <div style={{ height: '100px', margin: '10px', overflow: 'auto', whiteSpace: 'nowrap', marginBottom: '20px' }}>
              <div id="legendRefRadial" ref={legendRefRadial} style={{ display: 'flex', flexDirection: 'column' }}></div>
            </div>
            <div id="tooltip" style={{ position: 'absolute', visibility: 'hidden' }}></div>
          </div>
        </div>
        <div style={{ flex: '1', border: '3px solid black',borderRadius: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <svg ref={svgLineRef} width={600} height={390}></svg> {/* Contenedor SVG para el gráfico de líneas */}
        </div>
      </div>
    </div>
  );
}

const obtenerIndicadoresUnicos = (data) => {
  const indicadores = data.map(item => item.Indicador);
  return [...new Set(indicadores)];
};

const obtenerAniosUnicos = (data) => {
  const anios = data.map(item => item.Año);
  return [...new Set(anios)].sort();
};

const obtenerMesesUnicos = (data) => {
  const meses = data.map(item => item.Mes);
  return [...new Set(meses)].sort();
};

export default Grafico;