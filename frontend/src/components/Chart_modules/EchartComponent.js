import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

// dataPrices: number[]
function calculateMA(dayCount, dataPrices) {
  const result = [];
  for (let i = 0; i < dataPrices.length; i++) {
    if (i < dayCount) {
      result.push('-');
      continue;
    }
    let sum = 0;
    for (let j = 0; j < dayCount; j++) {
      sum += dataPrices[i - j];
    }
    result.push(Number((sum / dayCount).toFixed(2)));
  }
  return result;
}

const EchartComponent = ({ data, aiData, orders }) => {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  useEffect(() => {
    const safeData = Array.isArray(data) ? data : [];
    const safeAi = Array.isArray(aiData) ? aiData : [];
    const safeOrders = Array.isArray(orders) ? orders : [];

    if (!safeData.length) return;

    const chart = echarts.init(chartRef.current);
    chartInstance.current = chart;

    // ✅ chartData: [{time, price}]
    const times = safeData.map((p) => p.time);
    const prices = safeData.map((p) => Number(p.price));

    // 마지막 시점 기준으로 예측 시간 생성
    const lastTimeStr = times[times.length - 1];
    const lastDate = new Date(lastTimeStr.replace(' ', 'T')); // "YYYY-MM-DD HH:mm:ss" -> Date

    const aiTimes = safeAi.map((_, index) => {
      const d = new Date(lastDate.getTime());
      d.setMinutes(d.getMinutes() + (index + 1));
      return formatDate(d);
    });

    // 예측 라인 데이터 (category x축이므로 y 값만 줘도 됨)
    const aiSeries = safeAi.map((v) => Number(v));

    const xAll = [...times, ...aiTimes];

    // ✅ Buy/Sell 마크 포인트: orders는 [{type, time, price}]
    // x축이 category니까 coord는 [xLabel, yValue] 형태로 주면 됨.
    const marks = [];
    safeOrders.forEach((o) => {
      if (!o || !o.time) return;
      const y = Number(o.price ?? 0);

      if (o.type === 'buy') {
        marks.push({
          name: 'Buy Point',
          coord: [o.time, y],
          value: 'Buy!',
          itemStyle: { color: '#ff0000' },
          label: { show: true, formatter: 'Buy!' },
        });
      } else if (o.type === 'sell') {
        marks.push({
          name: 'Sell Point',
          coord: [o.time, y],
          value: 'Sell!',
          itemStyle: { color: '#00ff00' },
          label: { show: true, formatter: 'Sell!' },
        });
      }
    });

    // 이동평균(실제 가격 구간만)
    const ma5 = calculateMA(5, prices);
    const ma10 = calculateMA(10, prices);
    const ma20 = calculateMA(20, prices);
    const ma30 = calculateMA(30, prices);

    // 예측 구간에 맞춰 MA도 길이 맞추기(예측 구간은 '-'로 채움)
    const pad = new Array(aiSeries.length).fill('-');
    const ma5All = [...ma5, ...pad];
    const ma10All = [...ma10, ...pad];
    const ma20All = [...ma20, ...pad];
    const ma30All = [...ma30, ...pad];

    // 실제 가격도 예측 구간 길이 맞추기
    const pricesAll = [...prices, ...pad];

    // 예측은 과거 구간은 '-'로 채우기
    const aiAll = [...new Array(prices.length).fill('-'), ...aiSeries];

    const option = {
      title: { text: '' },
      tooltip: { trigger: 'axis' },
      legend: { data: ['Price', 'MA5', 'MA10', 'MA20', 'MA30', 'Prediction'] },
      grid: { left: '10%', right: '10%', bottom: '15%' },
      xAxis: {
        type: 'category',
        data: xAll,
        boundaryGap: false,
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        scale: true,
        splitArea: { show: true },
      },
      dataZoom: [
        { type: 'inside', start: 80, end: 100 },
        { show: true, type: 'slider', top: '90%', start: 50, end: 100 },
      ],
      series: [
        {
          name: 'Price',
          type: 'line',
          data: pricesAll,
          smooth: true,
          showSymbol: false,
        },
        {
          name: 'MA5',
          type: 'line',
          data: ma5All,
          smooth: true,
          showSymbol: false,
          lineStyle: { opacity: 0.5 },
        },
        {
          name: 'MA10',
          type: 'line',
          data: ma10All,
          smooth: true,
          showSymbol: false,
          lineStyle: { opacity: 0.5 },
        },
        {
          name: 'MA20',
          type: 'line',
          data: ma20All,
          smooth: true,
          showSymbol: false,
          lineStyle: { opacity: 0.5 },
        },
        {
          name: 'MA30',
          type: 'line',
          data: ma30All,
          smooth: true,
          showSymbol: false,
          lineStyle: { opacity: 0.5 },
        },
        {
          name: 'Prediction',
          type: 'line',
          data: aiAll,
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 2 },
          markPoint: {
            data: marks,
          },
        },
      ],
    };

    chart.setOption(option);

    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.dispose();
    };
  }, [data, aiData, orders]);

  return <div ref={chartRef} style={{ width: '100%', height: '92%' }} />;
};

export default EchartComponent;
