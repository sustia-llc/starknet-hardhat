import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect, assert } from 'chai';
import { BigNumber, Contract, ContractFactory } from 'ethers';
import { starknet, network, ethers } from 'hardhat';
import {
  StarknetContractFactory,
  StarknetContract,
  HttpNetworkConfig,
} from 'hardhat/types';
import { TIMEOUT } from './constants';

describe('Postman', function() {
  this.timeout(TIMEOUT);

  const user = 1;
  const networkUrl: string = (network.config as HttpNetworkConfig).url;
  let L2contractFactory: StarknetContractFactory;
  let l2contract: StarknetContract;
  let L1L2Example: ContractFactory;
  let MockStarknetMessaging: ContractFactory;
  let mockStarknetMessaging: Contract;
  let l1l2Example: Contract;
  let signer: SignerWithAddress;

  before(async function () {
    L2contractFactory = await starknet.getContractFactory('l1l2');
    l2contract = await L2contractFactory.deploy();

    const signers = await ethers.getSigners();
    signer = signers[0];

    MockStarknetMessaging = await ethers.getContractFactory(
      'MockStarknetMessaging',
      signer,
    );
    mockStarknetMessaging = await MockStarknetMessaging.deploy();
    await mockStarknetMessaging.deployed();

    L1L2Example = await ethers.getContractFactory('L1L2Example', signer);
    l1l2Example = await L1L2Example.deploy(mockStarknetMessaging.address);
    await l1l2Example.deployed();
  });

  it('should deploy the messaging contract', async () => {
    const {
      address: deployedTo,
      l1_provider: L1Provider,
    } = await starknet.devnet.loadL1MessagingContract(networkUrl);


    expect(deployedTo).not.to.be.undefined;
    expect(L1Provider).to.equal(networkUrl);
  });

  it('should load the already deployed contract if the address is provided', async () => {

    const {
      address: loadedFrom,
    } = await starknet.devnet.loadL1MessagingContract(
      networkUrl,
      mockStarknetMessaging.address,
    );

    expect(mockStarknetMessaging.address).to.equal(loadedFrom);
  });

  it('should exchange messages between L1 and L2', async () => {
    /**
     * Load the mock messaging contract
     */

    await starknet.devnet.loadL1MessagingContract(
      networkUrl,
      mockStarknetMessaging.address,
    );

    /**
     * Increase the L2 contract balance to 100 and withdraw 10 from it.
     */

    await l2contract.invoke('increase_balance', {
      user,
      amount: 100,
    });
    await l2contract.invoke('withdraw', {
      user,
      amount: 10,
      L1_CONTRACT_ADDRESS: BigInt(l1l2Example.address),
    });
    let userL2Balance = await l2contract.call('get_balance', {
      user,
    });

    expect(userL2Balance).to.deep.equal({ balance: 90n });

    /**
     * Flushing the L2 messages so that they can be consumed by the L1.
     */

    const {
      n_consumed_l2_to_l1_messages,
    } = await starknet.devnet.flush();

    expect(n_consumed_l2_to_l1_messages).to.equal(1);

    /**
     * Check the L1 balance and withdraw 10 which will consume the L2 message.
     */

    let userL1Balance: BigNumber = await l1l2Example.userBalances(user);

    expect(userL1Balance.eq(0)).to.be.true;

    await l1l2Example.withdraw(l2contract.address, user, 10);
    userL1Balance = await l1l2Example.userBalances(user);

    expect(userL1Balance.eq(10)).to.be.true;

    /**
     * Deposit to the L2 contract, L1 balance should be decreased by 2.
     */

    await l1l2Example.deposit(l2contract.address, user, 2);

    userL1Balance = await l1l2Example.userBalances(user);

    expect(userL1Balance.eq(8)).to.be.true;

    /**
     * Check if L2 balance increased after the deposit
     */

    userL2Balance = await l2contract.call('get_balance', {
      user,
    });

    expect(userL2Balance).to.deep.equal({ balance: 90n });

    await starknet.devnet.flush();

    userL2Balance = await l2contract.call('get_balance', {
      user,
    });

    expect(userL2Balance).to.deep.equal({ balance: 92n });
  });
});