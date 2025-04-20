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
    propertyVerification: {
      functions: {},
      variables: {
        admin: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
      },
      maps: {
        verifiedProperties: new Map(),
      },
    },
  },
};

// Mock implementation of contract functions
const registerProperty = (propertyOwner, name, location) => {
  if (mockClarity.tx.sender !== mockClarity.contracts.propertyVerification.variables.admin) {
    return { type: 'err', value: 1 };
  }
  
  mockClarity.contracts.propertyVerification.maps.verifiedProperties.set(propertyOwner, {
    name,
    location,
    verified: false,
    verificationDate: 0,
  });
  
  return { type: 'ok', value: true };
};

const verifyProperty = (propertyOwner) => {
  if (mockClarity.tx.sender !== mockClarity.contracts.propertyVerification.variables.admin) {
    return { type: 'err', value: 1 };
  }
  
  const property = mockClarity.contracts.propertyVerification.maps.verifiedProperties.get(propertyOwner);
  if (!property) {
    return { type: 'err', value: 2 };
  }
  
  property.verified = true;
  property.verificationDate = mockClarity.block.height;
  mockClarity.contracts.propertyVerification.maps.verifiedProperties.set(propertyOwner, property);
  
  return { type: 'ok', value: true };
};

const isPropertyVerified = (propertyOwner) => {
  const property = mockClarity.contracts.propertyVerification.maps.verifiedProperties.get(propertyOwner);
  if (!property) {
    return { type: 'err', value: 3 };
  }
  
  return { type: 'ok', value: property.verified };
};

const getPropertyDetails = (propertyOwner) => {
  return mockClarity.contracts.propertyVerification.maps.verifiedProperties.get(propertyOwner) || null;
};

// Tests
describe('Property Verification Contract', () => {
  const hotelOwner = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG';
  
  beforeEach(() => {
    // Reset the map before each test
    mockClarity.contracts.propertyVerification.maps.verifiedProperties.clear();
  });
  
  it('should register a new property', () => {
    const result = registerProperty(hotelOwner, 'Grand Hotel', 'New York');
    expect(result.type).toBe('ok');
    
    const property = getPropertyDetails(hotelOwner);
    expect(property).not.toBeNull();
    expect(property.name).toBe('Grand Hotel');
    expect(property.location).toBe('New York');
    expect(property.verified).toBe(false);
  });
  
  it('should fail to register if not admin', () => {
    // Change sender to non-admin
    const originalSender = mockClarity.tx.sender;
    mockClarity.tx.sender = 'ST2JHG361ZXG51QTKY2NQCVBPPRRE2KZB1HR05NNC';
    
    const result = registerProperty(hotelOwner, 'Grand Hotel', 'New York');
    expect(result.type).toBe('err');
    expect(result.value).toBe(1);
    
    // Reset sender
    mockClarity.tx.sender = originalSender;
  });
  
  it('should verify a property', () => {
    // First register the property
    registerProperty(hotelOwner, 'Grand Hotel', 'New York');
    
    // Then verify it
    const result = verifyProperty(hotelOwner);
    expect(result.type).toBe('ok');
    
    const property = getPropertyDetails(hotelOwner);
    expect(property.verified).toBe(true);
    expect(property.verificationDate).toBe(mockClarity.block.height);
  });
  
  it('should check if a property is verified', () => {
    // Register and verify a property
    registerProperty(hotelOwner, 'Grand Hotel', 'New York');
    verifyProperty(hotelOwner);
    
    const result = isPropertyVerified(hotelOwner);
    expect(result.type).toBe('ok');
    expect(result.value).toBe(true);
  });
  
  it('should return error for non-existent property', () => {
    const result = isPropertyVerified('ST3NBRSFKX28FQ2ZJ1MAKX58HKHSDGNV5YC7WZ5S');
    expect(result.type).toBe('err');
  });
});
