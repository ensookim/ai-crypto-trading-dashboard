import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { styled, createGlobalStyle } from 'styled-components';
import { io } from 'socket.io-client';
import PieChartComponent from './Chart_modules/PieChartComponent.js';
import EchartComponent from './Chart_modules/EchartComponent.js';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:5000';
const socket = io(API_BASE);

// Styled Components
const GlobalStyle = createGlobalStyle`
  body, html {
    height: 100%;
    background-color: #4ea685;
    margin: 0;
    padding: 0;
    overflow-y: auto;
  }
`;

const ChartContainer = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  padding: 20px;
  overflow: hidden;

  @media (max-width: 768px) {
    padding: 10px;
  }
`;

const ChartWrapper = styled.div`
  width: 90vw;
  height: 70vh;
  background-color: #ffffff;
  padding: 20px;
  border-radius: 10px;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
  margin-bottom: 20px;
  margin-top: 20px;

  @media (max-width: 768px) {
    width: 100vw;
    height: calc(50vh + 30px);
    padding: 10px;
  }
`;

const InfoBlock = styled.div`
  width: 90vw;
  background-color: #ffffff;
  padding: 20px;
  margin-top: 20px;
  border-radius: 10px;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: space-around;
  align-items: center;

  @media (max-width: 768px) {
    width: 100vw;
    padding: 10px;
    flex-direction: column;
  }
`;

const BalanceTable = styled.table`
  width: 100%;
  border-collapse: collapse;

  th,
  td {
    border: 1px solid #ddd;
    padding: 8px;
    text-align: center;
  }

  th {
    background-color: #4ea685;
    color: white;
  }

  td {
    background-color: #cccccc;
    color: #333333;
  }

  tr:hover {
    background-color: #d1e7dd;
  }

  @media (max-width: 768px) {
    th,
    td {
      padding: 5px;
    }
  }

  @media (max-width: 480px) {
    font-size: 12px;
  }
`;

const StyledButton = styled.button`
  background-color: #4ea685;
  color: white;
  font-size: 16px;
  padding: 10px 20px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  transition: background-color 0.3s;

  &:hover {
    background-color: #3a7e6b;
  }

  @media (max-width: 768px) {
    font-size: 14px;
    padding: 8px 16px;
  }
`;

const WelcomeMessage = styled.h1`
  margin-bottom: 20px;
  color: #fff;
  font-family: 'Arial', sans-serif;
  font-size: 64px;
  text-shadow: 3px 3px 3px rgba(5, 5, 5, 0.7);

  @media (max-width: 768px) {
    font-size: 48px;
  }

  @media (max-width: 480px) {
    font-size: 36px;
  }
`;

function Main_Page() {
  const navigate = useNavigate();
  const location = useLocation();

  const [state, setState] = useState({
    chartData: [],
    KRW_balance: 0,
    expected_profit: 0,
    BTC_balance: 0,
    balance: [],
    order_log: [],
    excuted_order: [],
    scheduled_orders: [], // ✅ 추가
    profit_rate: [0, 0, 0, 0, [0, 0]],
    loading: true,
    error: null,
    username: location.state?.username || '',
    visibleOrders: 10,
    btcPrice: 0,
  });

  useEffect(() => {
    fetchData();
    fetchBtcPrice();

    socket.on('connect', () => {
      console.log('Connected to server');
    });

    socket.on('data_update', (response) => {
      if (!response) return;

      const {
        Inference_data = [],
        balances = [],
        chartData = [],
        order_log = [],
        excuted_order = [],
        scheduled_orders = [], // ✅ 추가
        expected_profit = 0,
        profit_rate = [],
      } = response;

      let KRW_balance = 0;
      let BTC_balance = 0;

      if (Array.isArray(balances)) {
        balances.forEach((b) => {
          if (!b || typeof b !== 'object') return;
          const currency = b.currency;
          const bal = Number(b.balance ?? 0);

          if (currency === 'KRW') KRW_balance = Math.round(bal * 100) / 100;
          if (currency === 'BTC') BTC_balance = bal;
        });
      }

      let profitRateView = [0, 0, 0, 0, [0, 0]];
      if (
        Array.isArray(profit_rate) &&
        profit_rate.length > 0 &&
        profit_rate[0]
      ) {
        const pr = profit_rate[0];
        profitRateView = [
          Number(pr.volume ?? 0),
          Number(pr.invested_krw ?? 0),
          Number(pr.total_krw ?? 0),
          Number(pr.avg_buy_price ?? 0),
          [Number(pr.pnl_rate ?? 0), Number(pr.pnl_krw ?? 0)],
        ];
      }

      setState((prev) => ({
        ...prev,
        chartData: Array.isArray(chartData) ? chartData : [],
        KRW_balance,
        BTC_balance,
        expected_profit: Math.round(Number(expected_profit || 0) * 100) / 100,
        balance: Array.isArray(balances) ? balances : [],
        AI_Inference_data: Array.isArray(Inference_data) ? Inference_data : [],
        order_log: Array.isArray(order_log) ? order_log : [],
        excuted_order: Array.isArray(excuted_order) ? excuted_order : [],
        scheduled_orders: Array.isArray(scheduled_orders)
          ? scheduled_orders
          : [], // ✅ 추가
        profit_rate: profitRateView,
      }));
    });

    return () => {
      socket.off('data_update');
    };
  }, []);

  const fetchBtcPrice = async () => {
    try {
      const res = await axios.get(
        'https://api.upbit.com/v1/ticker?markets=KRW-BTC',
      );
      const price = Number(res.data?.[0]?.trade_price ?? 0);

      setState((prev) => ({
        ...prev,
        btcPrice: price,
      }));
    } catch (e) {
      console.error('BTC 현재가 불러오기 실패:', e);
    }
  };

  const fetchData = async () => {
    try {
      const response = await axios.get(`${API_BASE}/api/initial_data`);

      const {
        Inference_data = [],
        balances = [],
        chartData = [],
        order_log = [],
        excuted_order = [],
        scheduled_orders = [], // ✅ 추가
        expected_profit = 0,
        profit_rate = [],
      } = response.data || {};

      let KRW_balance = 0;
      let BTC_balance = 0;

      if (Array.isArray(balances)) {
        balances.forEach((b) => {
          if (!b || typeof b !== 'object') return;
          const currency = b.currency;
          const bal = Number(b.balance ?? 0);

          if (currency === 'KRW') KRW_balance = Math.round(bal * 100) / 100;
          if (currency === 'BTC') BTC_balance = bal;
        });
      }

      let profitRateView = [0, 0, 0, 0, [0, 0]];
      if (
        Array.isArray(profit_rate) &&
        profit_rate.length > 0 &&
        profit_rate[0]
      ) {
        const pr = profit_rate[0];
        profitRateView = [
          Number(pr.volume ?? 0),
          Number(pr.invested_krw ?? 0),
          Number(pr.total_krw ?? 0),
          Number(pr.avg_buy_price ?? 0),
          [Number(pr.pnl_rate ?? 0), Number(pr.pnl_krw ?? 0)],
        ];
      }

      setState((prev) => ({
        ...prev,
        chartData: Array.isArray(chartData) ? chartData : [],
        KRW_balance,
        BTC_balance,
        expected_profit: Math.round(Number(expected_profit || 0) * 100) / 100,
        balance: Array.isArray(balances) ? balances : [],
        AI_Inference_data: Array.isArray(Inference_data) ? Inference_data : [],
        order_log: Array.isArray(order_log) ? order_log : [],
        excuted_order: Array.isArray(excuted_order) ? excuted_order : [],
        scheduled_orders: Array.isArray(scheduled_orders)
          ? scheduled_orders
          : [], // ✅ 추가
        profit_rate: profitRateView,
        loading: false,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: 'Error fetching data',
      }));
      console.error('Error fetching data:', error);
    }
  };

  const handleBackToLogin = () => navigate('/login');

  if (state.loading) return <div>Loading...</div>;
  if (state.error) return <div>{state.error}</div>;

  return (
    <>
      <GlobalStyle />
      <ChartContainer>
        <WelcomeMessage>환영합니다 {state.username}님!</WelcomeMessage>
        <StyledButton onClick={handleBackToLogin}>로그인 돌아가기</StyledButton>

        <ChartWrapper>
          <BalanceTable>
            <thead>
              <tr>
                <th colSpan={3}>
                  <h1>BTC 차트</h1>
                </th>
              </tr>
            </thead>
          </BalanceTable>

          {state.chartData?.length > 0 ? (
            <EchartComponent
              data={state.chartData}
              aiData={state.AI_Inference_data}
              orders={state.excuted_order}
            />
          ) : (
            <div>No chart data available</div>
          )}
        </ChartWrapper>

        <InfoBlock>
          <PieChartComponent balance={state.balance} />

          <BalanceTable>
            <thead>
              <tr>
                <th colSpan={2}>
                  <h1>현재 수익</h1>
                </th>
              </tr>
              <tr>
                <th style={{ fontSize: 20 }}>항목</th>
                <th style={{ fontSize: 20 }}>값</th>
              </tr>
            </thead>

            <tbody style={{ fontFamily: 'Arial', fontSize: 20 }}>
              <tr>
                <td>보유 수량</td>
                <td>{state.profit_rate[0]}</td>
              </tr>
              <tr>
                <td>총 매수 금액</td>
                <td>{state.profit_rate[1]}</td>
              </tr>
              <tr>
                <td>현재 평가 금액</td>
                <td>{state.profit_rate[2]}</td>
              </tr>
              <tr>
                <td>평균 매수가</td>
                <td>{state.profit_rate[3]}</td>
              </tr>
              <tr>
                <td>수익률(ROI)</td>
                <td
                  style={{
                    color: state.profit_rate[4][0] > 0 ? 'red' : 'blue',
                  }}
                >
                  {state.profit_rate[4][0]}%
                </td>
              </tr>
              <tr>
                <td>평가 손익</td>
                <td
                  style={{
                    color: state.profit_rate[4][1] > 0 ? 'red' : 'blue',
                  }}
                >
                  {state.profit_rate[4][1]}원
                </td>
              </tr>
            </tbody>
          </BalanceTable>
        </InfoBlock>

        <InfoBlock>
          <BalanceTable>
            <thead>
              <tr>
                <th colSpan={3}>
                  <h1>계좌</h1>
                </th>
              </tr>
              <tr>
                <th>원화 잔고(KRW)</th>
                <th>비트코인 잔고(BTC)</th>
                <th>예상 수익</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{state.KRW_balance}</td>
                <td>{state.BTC_balance}</td>
                <td>{state.expected_profit}</td>
              </tr>
            </tbody>
          </BalanceTable>
        </InfoBlock>

        <InfoBlock>
          <BalanceTable>
            <thead>
              <tr>
                <th colSpan={3}>
                  <h1>예정된 거래</h1>
                </th>
              </tr>
              <tr>
                <th>구분</th>
                <th>가격</th>
                <th>시간</th>
              </tr>
            </thead>
            <tbody>
              {state.scheduled_orders?.length > 0 ? (
                state.scheduled_orders.map((o, i) => (
                  <tr key={i}>
                    <td>{o.type === 'buy' ? '매수' : '매도'}</td>
                    <td>{Math.round(o.price).toLocaleString()}원</td>
                    <td>{o.time}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3}>예정된 거래 없음</td>
                </tr>
              )}
            </tbody>
          </BalanceTable>
        </InfoBlock>

        <InfoBlock>
          <BalanceTable>
            <thead>
              <tr>
                <th colSpan={4}>
                  <h1>거래 내역</h1>
                </th>
              </tr>
              <tr>
                <th>마켓</th>
                <th>수량</th>
                <th>수수료</th>
                <th>시간</th>
              </tr>
            </thead>

            <tbody>
              {state.order_log?.length > 0 ? (
                <>
                  {state.order_log
                    .slice(0, state.visibleOrders)
                    .map((order, idx) => (
                      <tr key={idx}>
                        <td>{order.market}</td>
                        <td>{order.volume}</td>
                        <td>{order.paid_fee}</td>
                        <td>{order.time}</td>
                      </tr>
                    ))}

                  <tr>
                    <td
                      colSpan={4}
                      style={{ textAlign: 'center', padding: 10 }}
                    >
                      {state.order_log.length > state.visibleOrders && (
                        <StyledButton
                          onClick={() =>
                            setState((prev) => ({
                              ...prev,
                              visibleOrders: prev.visibleOrders + 10,
                            }))
                          }
                        >
                          이전 내역 불러오기
                        </StyledButton>
                      )}
                    </td>
                  </tr>
                </>
              ) : (
                <tr>
                  <td colSpan={4}>거래 내역 없음</td>
                </tr>
              )}
            </tbody>
          </BalanceTable>
        </InfoBlock>
      </ChartContainer>
    </>
  );
}

export default Main_Page;
