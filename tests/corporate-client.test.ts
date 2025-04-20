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
    corporateClient: {
      functions: {},
      variables: {
        admin: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
      },
      maps: {
        rateAgreements: new Map(),
      },
    },
  },
};

// Helper to create map keys
const createKey = (hotelId, clientId) => `${hotelId}-${clientId}`;

// Mock implementation of contract functions
const createRateAgreement = (hotelId, clientId, rate, startDate, endDate) => {
  if (mockClarity.tx.sender !== hotelId && mockClarity.tx.sender !== mockClarity.contracts.corporateClient.variables.admin) {
    return { type: 'err', value: 1 };
  }
  
  if (endDate <= startDate) {
    return { type: 'err', value: 2 };
  }
  
  const key = createKey(hotelId, clientId);
  mockClarity.contracts.corporateClient.maps.rateAgreements.set(key, {
    rate,
    startDate,
    endDate,
    active: true,
  });
  
  return { type: 'ok', value: true };
};

const updateRateAgreement = (hotelId, clientId, rate, endDate) => {
  if (mockClarity.tx.sender !== hotelId && mockClarity.tx.sender !== mockClarity.contracts.corporateClient.variables.admin) {
    return { type: 'err', value: 1 };
  }
  
  const key = createKey(hotelId, clientId);
  const agreement = mockClarity.contracts.corporateClient.maps.rateAgreements.get(key);
  
  if (!agreement) {
    return { type: 'err', value: 3 };
  }
  
  if (endDate <= agreement.startDate) {
    return { type: 'err', value: 2 };
  }
  
  agreement.rate = rate;
  agreement.endDate = endDate;
  mockClarity.contracts.corporateClient.maps.rateAgreements.set(key, agreement);
  
  return { type: 'ok', value: true };
};

const deactivateRateAgreement = (hotelId, clientId) => {
  if (mockClarity.tx.sender !== hotelId && mockClarity.tx.sender !== mockClarity.contracts.corporateClient.variables.admin) {
    return { type: 'err', value: 1 };
  }
  
  const key = createKey(hotelId, clientId);
  const agreement = mockClarity.contracts.corporateClient.maps.rateAgreements.get(key);
  
  if (!agreement) {
    return { type: 'err', value: 3 };
  }
  
  agreement.active = false;
  mockClarity.contracts.corporateClient.maps.rateAgreements.set(key, agreement);
  
  return { type: 'ok', value: true };
};

const getRateAgreement = (hotelId, clientId) => {
  const key = createKey(hotelId, clientId);
  return mockClarity.contracts.corporateClient.maps.rateAgreements.get(key) || null;
};

const isAgreementActive = (hotelId, clientId) => {
  const key = createKey(hotelId, clientId);
  const agreement = mockClarity.contracts.corporateClient.maps.rateAgreements.get(key);
  
  if (!agreement) {
    return false;
  }
  
  return agreement.active &&
      agreement.endDate >= mockClarity.block.height &&
      agreement.startDate <= mockClarity.block.height;
};

// Tests
describe('Corporate Client Contract', () => {
  const hotelId = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG';
  const clientId = 'ST2JHG361ZXG51QTKY2NQCVBPPRRE2KZB1HR05NNC';
  
  beforeEach(() => {
    // Reset the map before each test
    mockClarity.contracts.corporateClient.maps.rateAgreements.clear();
  });
  
  it('should create a new rate agreement', () => {
    // Set sender to hotel
    mockClarity.tx.sender = hotelId;
    
    const result = createRateAgreement(hotelId, clientId, 150, 50, 200);
    expect(result.type).toBe('ok');
    
    const agreement = getRateAgreement(hotelId, clientId);
    expect(agreement).not.toBeNull();
    expect(agreement.rate).toBe(150);
    expect(agreement.startDate).toBe(50);
    expect(agreement.endDate).toBe(200);
    expect(agreement.active).toBe(true);
  });
  
  it('should fail to create agreement with invalid dates', () => {
    mockClarity.tx.sender = hotelId;
    
    const result = createRateAgreement(hotelId, clientId, 150, 200, 50); // end before start
    expect(result.type).toBe('err');
    expect(result.value).toBe(2);
  });
  
  it('should update an existing rate agreement', () => {
    mockClarity.tx.sender = hotelId;
    
    // First create an agreement
    createRateAgreement(hotelId, clientId, 150, 50, 200);
    
    // Then update it
    const result = updateRateAgreement(hotelId, clientId, 180, 250);
    expect(result.type).toBe('ok');
    
    const agreement = getRateAgreement(hotelId, clientId);
    expect(agreement.rate).toBe(180);
    expect(agreement.endDate).toBe(250);
    expect(agreement.active).toBe(true);
  });
  
  it('should deactivate a rate agreement', () => {
    mockClarity.tx.sender = hotelId;
    
    // First create an agreement
    createRateAgreement(hotelId, clientId, 150, 50, 200);
    
    // Then deactivate it
    const result = deactivateRateAgreement(hotelId, clientId);
    expect(result.type).toBe('ok');
    
    const agreement = getRateAgreement(hotelId, clientId);
    expect(agreement.active).toBe(false);
  });
  
  it('should check if an agreement is active', () => {
    mockClarity.tx.sender = hotelId;
    
    // Create an active agreement (current block height is 100)
    createRateAgreement(hotelId, clientId, 150, 50, 200);
    
    const isActive = isAgreementActive(hotelId, clientId);
    expect(isActive).toBe(true);
    
    // Deactivate the agreement
    deactivateRateAgreement(hotelId, clientId);
    
    const isStillActive = isAgreementActive(hotelId, clientId);
    expect(isStillActive).toBe(false);
  });
});
