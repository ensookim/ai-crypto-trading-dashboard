import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import * as echarts from 'echarts';

const PieChartComponent = ({ balance }) => {
  const chartRef = useRef(null);
  const [btcPrice, setBtcPrice] = useState(null);

  // BTC 현재가 가져오기 (원화 환산용)
  useEffect(() => {
    let mounted = true;
    axios
      .get('https://api.upbit.com/v1/ticker?markets=KRW-BTC')
      .then((res) => {
        const p = res?.data?.[0]?.trade_price;
        if (mounted && typeof p === 'number') setBtcPrice(p);
      })
      .catch((err) => {
        console.error('BTC price fetch error:', err);
        if (mounted) setBtcPrice(null);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const chart = echarts.init(chartRef.current);

    const safeBalance = Array.isArray(balance) ? balance : [];

    // ✅ balance: [{currency, balance, avg_buy_price}]
    // BTC는 원화 가치로 환산(가격 있으면), 나머지는 그대로 표시
    const data = safeBalance
      .map((b) => {
        if (!b || typeof b !== 'object') return null;

        const currency = b.currency;
        let value = Number(b.balance ?? 0);

        if (currency === 'BTC' && btcPrice != null) {
          value = value * btcPrice; // BTC -> KRW 가치
        }

        // 값이 0이면 파이에서 빼도 됨
        if (!isFinite(value) || value <= 0) return null;

        return {
          value,
          name: currency, // ✅ currency 사용
        };
      })
      .filter(Boolean);

    const option = {
      title: {
        text: 'Current Balance',
        left: 'center',
        top: '5%',
        textStyle: {
          fontSize: 24,
          fontFamily: 'Arial',
          fontWeight: 'bold',
          color: '#333',
        },
      },
      tooltip: {
        trigger: 'item',
        formatter: (params) => {
          // BTC를 KRW로 환산했으니 단위는 KRW에 가까움
          const v = Number(params.value || 0);
          return `${params.name}: ${v.toLocaleString()}${params.name === 'KRW' ? '원' : ''}`;
        },
      },
      legend: {
        bottom: '5%',
        left: 'center',
      },
      series: [
        {
          name: 'Balance',
          type: 'pie',
          radius: ['40%', '70%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 10,
            borderColor: '#fff',
            borderWidth: 2,
          },
          label: {
            show: false,
            position: 'center',
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 28,
              fontWeight: 'bold',
            },
          },
          labelLine: {
            show: false,
          },
          data,
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
  }, [balance, btcPrice]);

  return <div ref={chartRef} style={{ width: '50%', height: '400px' }} />;
};

export default PieChartComponent;
