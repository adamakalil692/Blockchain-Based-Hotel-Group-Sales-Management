import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the Clarity environment
const mockClarity = {
  tx: {
    sender: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM', // Admin address
  },
  block: {
    height: 100,
  },
  contracts: {
    commissionManagement: {
      functions: {},
      variables: {
        admin: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
      },
      maps: {
        commissionRates: new Map(),
        commissionPayments: new Map(),
      },
    },
  },
};

// Helper to create map keys
const createRateKey = (hotelId, agencyId) => `${hotelId}-${agencyId}`;
const createPaymentKey = (hotelId, agencyId, bookingId) => `${hotelId}-${agencyId}-${bookingId}`;

// Mock implementation of contract functions
const setCommissionRate = (hotelId, agencyId, ratePercentage) => {
  if (mockClarity.tx.sender !== hotelId && mockClarity.tx.sender !== mockClarity.contracts.commissionManagement.variables.admin) {
    return { type: 'err', value: 1 };
  }
  
  if (ratePercentage > 100) {
    return { type: 'err', value: 2 };
  }
  
  const key = createRateKey(hotelId, agencyId);
  mockClarity.contracts.commissionManagement.maps.commissionRates.set(key, {
    ratePercentage,
    active: true,
  });
  
  return { type: 'ok', value: true };
};

const deactivateCommissionRate = (hotelId, agencyId) => {
  if (mockClarity.tx.sender !== hotelId && mockClarity.tx.sender !== mockClarity.contracts.commissionManagement.variables.admin) {
    return { type: 'err', value: 1 };
  }
  
  const key = createRateKey(hotelId, agencyId);
  const rate = mockClarity.contracts.commissionManagement.maps.commissionRates.get(key);
  
  if (!rate) {
    return { type: 'err', value: 3 };
  }
  
  rate.active = false;
  mockClarity.contracts.commissionManagement.maps.commissionRates.set(key, rate);
  
  return { type: 'ok', value: true };
};

const recordCommission = (hotelId, agencyId, bookingId, bookingValue) => {
  if (mockClarity.tx.sender !== hotelId && mockClarity.tx.sender !== mockClarity.contracts.commissionManagement.variables.admin) {
    return { type: 'err', value: 1 };
  }
  
  const rateKey = createRateKey(hotelId, agencyId);
  const rate = mockClarity.contracts.commissionManagement.maps.commissionRates.get(rateKey);
  
  if (!rate) {
    return { type: 'err', value: 3 };
  }
  
  if (!rate.active) {
    return { type: 'err', value: 4 };
  }
  
  const commissionAmount = Math.floor((bookingValue * rate.ratePercentage) / 100);
  
  const paymentKey = createPaymentKey(hotelId, agencyId, bookingId);
  mockClarity.contracts.commissionManagement.maps.commissionPayments.set(paymentKey, {
    amount: commissionAmount,
    bookingValue,
    paid: false,
    paymentDate: 0,
  });
  
  return { type: 'ok', value: true };
};

const payCommission = (hotelId, agencyId, bookingId) => {
  if (mockClarity.tx.sender !== hotelId && mockClarity.tx.sender !== mockClarity.contracts.commissionManagement.variables.admin) {
    return { type: 'err', value: 1 };
  }
  
  const paymentKey = createPaymentKey(hotelId, agencyId, bookingId);
  const payment = mockClarity.contracts.commissionManagement.maps.commissionPayments.get(paymentKey);
  
  if (!payment) {
    return { type: 'err', value: 5 };
  }
  
  payment.paid = true;
  payment.paymentDate = mockClarity.block.height;
  mockClarity.contracts.commissionManagement.maps.commissionPayments.set(paymentKey, payment);
  
  return { type: 'ok', value: true };
};

const getCommissionRate = (hotelId, agencyId) => {
  const key = createRateKey(hotelId, agencyId);
  return mockClarity.contracts.commissionManagement.maps.commissionRates.get(key) || null;
};

const getCommissionPayment = (hotelId, agencyId, bookingId) => {
  const key = createPaymentKey(hotelId, agencyId, bookingId);
  return mockClarity.contracts.commissionManagement.maps.commissionPayments.get(key) || null;
};

// Tests
describe('Commission Management Contract', () => {
  const hotelId = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG';
  const agencyId = 'ST2JHG361ZXG51QTKY2NQCVBPPRRE2KZB1HR05NNC';
  const bookingId = 'booking123';
  
  beforeEach(() => {
    // Reset the maps before each test
    mockClarity.contracts.commissionManagement.maps.commissionRates.clear();
    mockClarity.contracts.commissionManagement.maps.commissionPayments.clear();
  });
  
  it('should set a commission rate', () => {
    // Set sender to hotel
    mockClarity.tx.sender = hotelId;
    
    const result = setCommissionRate(hotelId, agencyId, 10);
    expect(result.type).toBe('ok');
    
    const rate = getCommissionRate(hotelId, agencyId);
    expect(rate).not.toBeNull();
    expect(rate.ratePercentage).toBe(10);
    expect(rate.active).toBe(true);
  });
  
  it('should fail to set rate over 100%', () => {
    mockClarity.tx.sender = hotelId;
    
    const result = setCommissionRate(hotelId, agencyId, 110);
    expect(result.type).toBe('err');
    expect(result.value).toBe(2);
  });
  
  it('should deactivate a commission rate', () => {
    mockClarity.tx.sender = hotelId;
    
    // First set a rate
    setCommissionRate(hotelId, agencyId, 10);
    
    // Then deactivate it
    const result = deactivateCommissionRate(hotelId, agencyId);
    expect(result.type).toBe('ok');
    
    const rate = getCommissionRate(hotelId, agencyId);
    expect(rate.active).toBe(false);
  });
  
  it('should record a commission payment', () => {
    mockClarity.tx.sender = hotelId;
    
    // First set a rate
    setCommissionRate(hotelId, agencyId, 10);
    
    // Then record a commission
    const result = recordCommission(hotelId, agencyId, bookingId, 1000);
    expect(result.type).toBe('ok');
    
    const payment = getCommissionPayment(hotelId, agencyId, bookingId);
    expect(payment).not.toBeNull();
    expect(payment.amount).toBe(100); // 10% of 1000
    expect(payment.bookingValue).toBe(1000);
    expect(payment.paid).toBe(false);
  });
  
  it('should mark a commission as paid', () => {
    mockClarity.tx.sender = hotelId;
    
    // Set up a commission payment
    setCommissionRate(hotelId, agencyId, 10);
    recordCommission(hotelId, agencyId, bookingId, 1000);
    
    // Mark it as paid
    const result = payCommission(hotelId, agencyId, bookingId);
    expect(result.type).toBe('ok');
    
    const payment = getCommissionPayment(hotelId, agencyId, bookingId);
    expect(payment.paid).toBe(true);
    expect(payment.paymentDate).toBe(mockClarity.block.height);
  });
  
  it('should fail to record commission with inactive rate', () => {
    mockClarity.tx.sender = hotelId;
    
    // Set a rate and deactivate it
    setCommissionRate(hotelId, agencyId, 10);
    deactivateCommissionRate(hotelId, agencyId);
    
    // Try to record a commission
    const result = recordCommission(hotelId, agencyId, bookingId, 1000);
    expect(result.type).toBe('err');
    expect(result.value).toBe(4);
  });
});
