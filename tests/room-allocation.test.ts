
import { describe, expect, it } from "vitest";

const accounts = simnet.getAccounts();
const address1 = accounts.get("wallet_1")!;

/*
  The test below is an example. To learn more, read the testing documentation here:
  https://docs.hiro.so/stacks/clarinet-js-sdk
*/

describe("example tests", () => {
  it("ensures simnet is well initalised", () => {
    expect(simnet.blockHeight).toBeDefined();
  });

  // it("shows an example", () => {
  //   const { result } = simnet.callReadOnlyFn("counter", "get-counter", [], address1);
  //   expect(result).toBeUint(0);
  // });
});
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
    roomAllocation: {
      functions: {},
      variables: {
        admin: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
      },
      maps: {
        allocationContracts: new Map(),
        bookings: new Map(),
      },
    },
  },
};

// Helper to create map keys
const createContractKey = (hotelId, clientId) => `${hotelId}-${clientId}`;
const createBookingKey = (hotelId, clientId, bookingId) => `${hotelId}-${clientId}-${bookingId}`;

// Mock implementation of contract functions
const createAllocationContract = (hotelId, clientId, totalRooms, minimumCommitment, startDate, endDate) => {
  if (mockClarity.tx.sender !== hotelId && mockClarity.tx.sender !== mockClarity.contracts.roomAllocation.variables.admin) {
    return { type: 'err', value: 1 };
  }
  
  if (totalRooms < minimumCommitment) {
    return { type: 'err', value: 2 };
  }
  
  if (endDate <= startDate) {
    return { type: 'err', value: 3 };
  }
  
  const key = createContractKey(hotelId, clientId);
  mockClarity.contracts.roomAllocation.maps.allocationContracts.set(key, {
    totalRooms,
    usedRooms: 0,
    minimumCommitment,
    startDate,
    endDate,
  });
  
  return { type: 'ok', value: true };
};

const recordBooking = (hotelId, clientId, bookingId, rooms, checkIn, checkOut) => {
  if (mockClarity.tx.sender !== clientId &&
      mockClarity.tx.sender !== hotelId &&
      mockClarity.tx.sender !== mockClarity.contracts.roomAllocation.variables.admin) {
    return { type: 'err', value: 1 };
  }
  
  const contractKey = createContractKey(hotelId, clientId);
  const contract = mockClarity.contracts.roomAllocation.maps.allocationContracts.get(contractKey);
  
  if (!contract) {
    return { type: 'err', value: 4 };
  }
  
  const newUsedRooms = contract.usedRooms + rooms;
  
  if (newUsedRooms > contract.totalRooms) {
    return { type: 'err', value: 5 };
  }
  
  if (checkIn < contract.startDate || checkOut > contract.endDate) {
    return { type: 'err', value: 6 };
  }
  
  // Update the allocation contract
  contract.usedRooms = newUsedRooms;
  mockClarity.contracts.roomAllocation.maps.allocationContracts.set(contractKey, contract);
  
  // Record the booking
  const bookingKey = createBookingKey(hotelId, clientId, bookingId);
  mockClarity.contracts.roomAllocation.maps.bookings.set(bookingKey, {
    rooms,
    checkIn,
    checkOut,
    fulfilled: false,
  });
  
  return { type: 'ok', value: true };
};

const fulfillBooking = (hotelId, clientId, bookingId) => {
  if (mockClarity.tx.sender !== hotelId) {
    return { type: 'err', value: 1 };
  }
  
  const bookingKey = createBookingKey(hotelId, clientId, bookingId);
  const booking = mockClarity.contracts.roomAllocation.maps.bookings.get(bookingKey);
  
  if (!booking) {
    return { type: 'err', value: 7 };
  }
  
  booking.fulfilled = true;
  mockClarity.contracts.roomAllocation.maps.bookings.set(bookingKey, booking);
  
  return { type: 'ok', value: true };
};

const getAllocationContract = (hotelId, clientId) => {
  const key = createContractKey(hotelId, clientId);
  return mockClarity.contracts.roomAllocation.maps.allocationContracts.get(key) || null;
};

const getBooking = (hotelId, clientId, bookingId) => {
  const key = createBookingKey(hotelId, clientId, bookingId);
  return mockClarity.contracts.roomAllocation.maps.bookings.get(key) || null;
};

const isMinimumCommitmentMet = (hotelId, clientId) => {
  const key = createContractKey(hotelId, clientId);
  const contract = mockClarity.contracts.roomAllocation.maps.allocationContracts.get(key);
  
  if (!contract) {
    return false;
  }
  
  return contract.usedRooms >= contract.minimumCommitment;
};

// Tests
describe('Room Allocation Contract', () => {
  const hotelId = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG';
  const clientId = 'ST2JHG361ZXG51QTKY2NQCVBPPRRE2KZB1HR05NNC';
  const bookingId = 'booking123';
  
  beforeEach(() => {
    // Reset the maps before each test
    mockClarity.contracts.roomAllocation.maps.allocationContracts.clear();
    mockClarity.contracts.roomAllocation.maps.bookings.clear();
  });
  
  it('should create a new allocation contract', () => {
    // Set sender to hotel
    mockClarity.tx.sender = hotelId;
    
    const result = createAllocationContract(hotelId, clientId, 100, 50, 50, 200);
    expect(result.type).toBe('ok');
    
    const contract = getAllocationContract(hotelId, clientId);
    expect(contract).not.toBeNull();
    expect(contract.totalRooms).toBe(100);
    expect(contract.usedRooms).toBe(0);
    expect(contract.minimumCommitment).toBe(50);
    expect(contract.startDate).toBe(50);
    expect(contract.endDate).toBe(200);
  });
  
  it('should record a booking against the allocation', () => {
    mockClarity.tx.sender = hotelId;
    
    // First create an allocation contract
    createAllocationContract(hotelId, clientId, 100, 50, 50, 200);
    
    // Then record a booking
    const result = recordBooking(hotelId, clientId, bookingId, 20, 75, 85);
    expect(result.type).toBe('ok');
    
    // Check the booking was recorded
    const booking = getBooking(hotelId, clientId, bookingId);
    expect(booking).not.toBeNull();
    expect(booking.rooms).toBe(20);
    expect(booking.checkIn).toBe(75);
    expect(booking.checkOut).toBe(85);
    expect(booking.fulfilled).toBe(false);
    
    // Check the allocation was updated
    const contract = getAllocationContract(hotelId, clientId);
    expect(contract.usedRooms).toBe(20);
  });
  
  it('should fail to record booking if exceeding total rooms', () => {
    mockClarity.tx.sender = hotelId;
    
    // Create an allocation contract
    createAllocationContract(hotelId, clientId, 100, 50, 50, 200);
    
    // Try to record a booking that exceeds the total
    const result = recordBooking(hotelId, clientId, bookingId, 120, 75, 85);
    expect(result.type).toBe('err');
    expect(result.value).toBe(5);
  });
  
  it('should mark a booking as fulfilled', () => {
    mockClarity.tx.sender = hotelId;
    
    // Create an allocation contract and record a booking
    createAllocationContract(hotelId, clientId, 100, 50, 50, 200);
    recordBooking(hotelId, clientId, bookingId, 20, 75, 85);
    
    // Mark the booking as fulfilled
    const result = fulfillBooking(hotelId, clientId, bookingId);
    expect(result.type).toBe('ok');
    
    // Check the booking was updated
    const booking = getBooking(hotelId, clientId, bookingId);
    expect(booking.fulfilled).toBe(true);
  });
  
  it('should check if minimum commitment is met', () => {
    mockClarity.tx.sender = hotelId;
    
    // Create an allocation contract
    createAllocationContract(hotelId, clientId, 100, 50, 50, 200);
    
    // Initially, minimum commitment is not met
    expect(isMinimumCommitmentMet(hotelId, clientId)).toBe(false);
    
    // Record bookings to meet the minimum
    recordBooking(hotelId, clientId, 'booking1', 30, 75, 85);
    recordBooking(hotelId, clientId, 'booking2', 20, 90, 100);
    
    // Now minimum commitment should be met
    expect(isMinimumCommitmentMet(hotelId, clientId)).toBe(true);
  });
});
