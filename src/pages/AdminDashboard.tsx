import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Users, 
  Package, 
  DollarSign, 
  Shield,
  LogOut,
  Check,
  X,
  RefreshCw,
  Trash2
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/integrations/supabase/client';

interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  referral_code: string;
  wallet_balance: number;
  is_active: boolean;
  created_at: string;
}

interface InvestmentPackage {
  id: string;
  name: string;
  amount: number;
  return_amount: number;
  duration_days: number;
  max_purchases: number;
  is_active: boolean;
  package_type: 'daily' | 'stable';
  daily_income?: number;
}

interface WithdrawalRequest {
  id: string;
  user_id: string;
  amount: number;
  fee: number;
  net_amount: number;
  status: string;
  requested_at: string;
  profiles: Profile;
}

const AdminDashboard = () => {
  const { signOut } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<Profile[]>([]);
  const [packages, setPackages] = useState<InvestmentPackage[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('users');

  // Package form state
  const [packageForm, setPackageForm] = useState({
    name: '',
    amount: '',
    return_amount: '',
    duration_days: '',
    package_type: 'stable' as 'daily' | 'stable'
  });

  // Wallet adjustment form
  const [walletAdjustment, setWalletAdjustment] = useState({
    userId: '',
    amount: '',
    type: 'add' as 'add' | 'subtract'
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      console.log('Fetching admin data...');
      
      // Fetch all users using service role or RPC function
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      console.log('Users data:', usersData);
      console.log('Users error:', usersError);

      // Fetch all packages
      const { data: packagesData, error: packagesError } = await supabase
        .from('investment_packages')
        .select('*')
        .order('created_at', { ascending: false });

      // Fetch withdrawal requests
      const { data: withdrawalsData, error: withdrawalsError } = await supabase
        .from('withdrawal_requests')
        .select(`
          *,
          profiles!withdrawal_requests_user_id_fkey (*)
        `)
        .order('requested_at', { ascending: false });

      setUsers(usersData || []);
      setPackages((packagesData as any[])?.map(pkg => ({
        ...pkg,
        package_type: pkg.package_type as 'daily' | 'stable',
        daily_income: pkg.daily_income || 0
      })) || []);
      setWithdrawals(withdrawalsData || []);

      if (usersError) {
        console.error('Users fetch error:', usersError);
        toast({
          title: "Users Data Warning",
          description: "Could not fetch users data. This may be due to RLS policies.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to fetch dashboard data.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUserActivation = async (userId: string, activate: boolean) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: activate })
        .eq('id', userId);

      if (error) throw error;

      toast({
        title: activate ? "User Activated" : "User Deactivated",
        description: `User has been ${activate ? 'activated' : 'deactivated'} successfully.`,
      });

      await fetchData();
    } catch (error) {
      console.error('Error updating user:', error);
      toast({
        title: "Error",
        description: "Failed to update user status.",
        variant: "destructive",
      });
    }
  };

  const handleUserDeletion = async (userId: string, userName: string) => {
    if (!window.confirm(`Are you sure you want to delete user ${userName}? This action cannot be undone.`)) {
      return;
    }

    try {
      // First delete related records
      await supabase.from('user_investments').delete().eq('user_id', userId);
      await supabase.from('withdrawal_requests').delete().eq('user_id', userId);
      
      // Then delete the profile
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);

      if (error) throw error;

      // Also delete from auth.users if possible (this might require additional permissions)
      try {
        await supabase.auth.admin.deleteUser(userId);
      } catch (authError) {
        console.warn('Could not delete auth user:', authError);
      }

      toast({
        title: "User Deleted",
        description: `User ${userName} has been successfully deleted.`,
      });

      await fetchData();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast({
        title: "Error",
        description: "Failed to delete user.",
        variant: "destructive",
      });
    }
  };

  const handleWalletAdjustment = async () => {
    if (!walletAdjustment.userId || !walletAdjustment.amount) {
      toast({
        title: "Invalid Input",
        description: "Please select a user and enter an amount.",
        variant: "destructive",
      });
      return;
    }

    try {
      const user = users.find(u => u.id === walletAdjustment.userId);
      if (!user) return;

      const amount = parseFloat(walletAdjustment.amount);
      const newBalance = walletAdjustment.type === 'add' 
        ? user.wallet_balance + amount 
        : Math.max(0, user.wallet_balance - amount);

      const { error } = await supabase
        .from('profiles')
        .update({ wallet_balance: newBalance })
        .eq('id', walletAdjustment.userId);

      if (error) throw error;

      toast({
        title: "Wallet Adjusted",
        description: `User wallet has been ${walletAdjustment.type === 'add' ? 'credited' : 'debited'} with ${amount.toLocaleString()} RWF.`,
      });

      setWalletAdjustment({ userId: '', amount: '', type: 'add' });
      await fetchData();
    } catch (error) {
      console.error('Error adjusting wallet:', error);
      toast({
        title: "Error",
        description: "Failed to adjust wallet balance.",
        variant: "destructive",
      });
    }
  };

  const handleWithdrawalAction = async (withdrawalId: string, action: 'approve' | 'reject') => {
    try {
      const { error } = await supabase
        .from('withdrawal_requests')
        .update({ 
          status: action === 'approve' ? 'approved' : 'rejected',
          processed_at: new Date().toISOString()
        })
        .eq('id', withdrawalId);

      if (error) throw error;

      toast({
        title: `Withdrawal ${action === 'approve' ? 'Approved' : 'Rejected'}`,
        description: `The withdrawal request has been ${action}d.`,
      });

      await fetchData();
    } catch (error) {
      console.error('Error processing withdrawal:', error);
      toast({
        title: "Error",
        description: "Failed to process withdrawal request.",
        variant: "destructive",
      });
    }
  };

  const handlePackageCreate = async () => {
    if (!packageForm.name || !packageForm.amount || !packageForm.return_amount || !packageForm.duration_days) {
      toast({
        title: "Invalid Input",
        description: "Please fill in all package details.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('investment_packages')
        .insert({
          name: packageForm.name,
          amount: parseFloat(packageForm.amount),
          return_amount: parseFloat(packageForm.return_amount),
          duration_days: parseInt(packageForm.duration_days),
          max_purchases: 3,
          package_type: packageForm.package_type
        });

      if (error) throw error;

      toast({
        title: "Package Created",
        description: `New ${packageForm.package_type} investment package has been created successfully.`,
      });

      setPackageForm({ name: '', amount: '', return_amount: '', duration_days: '', package_type: 'stable' });
      await fetchData();
    } catch (error) {
      console.error('Error creating package:', error);
      toast({
        title: "Error",
        description: "Failed to create investment package.",
        variant: "destructive",
      });
    }
  };

  const handlePackageToggle = async (packageId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('investment_packages')
        .update({ is_active: !isActive })
        .eq('id', packageId);

      if (error) throw error;

      toast({
        title: `Package ${!isActive ? 'Activated' : 'Deactivated'}`,
        description: `The package has been ${!isActive ? 'activated' : 'deactivated'}.`,
      });

      await fetchData();
    } catch (error) {
      console.error('Error toggling package:', error);
      toast({
        title: "Error",
        description: "Failed to toggle package status.",
        variant: "destructive",
      });
    }
  };

  const handlePackageDelete = async (packageId: string, packageName: string) => {
    if (!window.confirm(`Are you sure you want to delete the package "${packageName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('investment_packages')
        .delete()
        .eq('id', packageId);

      if (error) throw error;

      toast({
        title: "Package Deleted",
        description: `Package "${packageName}" has been successfully deleted.`,
      });

      await fetchData();
    } catch (error) {
      console.error('Error deleting package:', error);
      toast({
        title: "Error",
        description: "Failed to delete investment package.",
        variant: "destructive",
      });
    }
  };

  const handleLogout = () => {
    signOut();
  };

  const stats = {
    totalUsers: users.length,
    activeUsers: users.filter(u => u.is_active).length,
    totalPackages: packages.length,
    pendingWithdrawals: withdrawals.filter(w => w.status === 'pending').length,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-red-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Shield className="h-8 w-8 text-red-600 mr-2" />
              <h1 className="text-xl font-bold text-gray-900">InvestX Admin</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Button variant="outline" size="sm" onClick={fetchData}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeUsers}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Investment Packages</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalPackages}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Withdrawals</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>  
            <CardContent>
              <div className="text-2xl font-bold">{stats.pendingWithdrawals}</div>
            </CardContent>
          </Card>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6">
          <div className="flex space-x-4">
            {['users', 'packages', 'withdrawals', 'wallet'].map((tab) => (
              <Button
                key={tab}
                variant={activeTab === tab ? 'default' : 'outline'}
                onClick={() => setActiveTab(tab)}
                className="capitalize"
              >
                {tab}
              </Button>
            ))}
          </div>
        </div>

        {/* Users Tab */}
        {activeTab === 'users' && (
          <Card>
            <CardHeader>
              <CardTitle>User Management</CardTitle>
              <CardDescription>
                Manage user accounts and activations. Users need admin approval before they can access the platform.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {users.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Referral Code</TableHead>
                      <TableHead>Wallet Balance</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Registered</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          {user.first_name} {user.last_name}
                        </TableCell>
                        <TableCell>{user.phone}</TableCell>
                        <TableCell>
                          <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                            {user.referral_code}
                          </code>
                        </TableCell>
                        <TableCell>{user.wallet_balance.toLocaleString()} RWF</TableCell>
                        <TableCell>
                          <Badge variant={user.is_active ? 'default' : 'secondary'}>
                            {user.is_active ? 'Active' : 'Pending Approval'}
                          </Badge>
                        </TableCell>
                        <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button
                              size="sm"
                              variant={user.is_active ? 'destructive' : 'default'}
                              onClick={() => handleUserActivation(user.id, !user.is_active)}
                            >
                              {user.is_active ? 'Deactivate' : 'Approve'}
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleUserDeletion(user.id, `${user.first_name} ${user.last_name}`)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No registered users found</p>
                  <p className="text-sm">New user registrations will appear here</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Packages Tab */}
        {activeTab === 'packages' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Create New Package</CardTitle>
                <CardDescription>Add a new investment package</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="packageName">Package Name</Label>
                  <Input
                    id="packageName"
                    placeholder="e.g., Premium Package"
                    value={packageForm.name}
                    onChange={(e) => setPackageForm({...packageForm, name: e.target.value})}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="amount">Investment Amount (RWF)</Label>
                  <Input
                    id="amount"
                    type="number"
                    placeholder="e.g., 50000"
                    value={packageForm.amount}
                    onChange={(e) => setPackageForm({...packageForm, amount: e.target.value})}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="returnAmount">Return Amount (RWF)</Label>
                  <Input
                    id="returnAmount"
                    type="number"
                    placeholder="e.g., 65000"
                    value={packageForm.return_amount}
                    onChange={(e) => setPackageForm({...packageForm, return_amount: e.target.value})}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="duration">Duration (Days)</Label>
                  <Input
                    id="duration"
                    type="number"
                    placeholder="e.g., 30"
                    value={packageForm.duration_days}
                    onChange={(e) => setPackageForm({...packageForm, duration_days: e.target.value})}
                  />
                </div>

                <div className="space-y-3">
                  <Label>Package Type</Label>
                  <RadioGroup 
                    value={packageForm.package_type} 
                    onValueChange={(value) => setPackageForm({...packageForm, package_type: value as 'daily' | 'stable'})}
                    className="flex flex-col space-y-2"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="stable" id="stable" />
                      <Label htmlFor="stable" className="cursor-pointer">
                        <div>
                          <span className="font-medium">Stable Package</span>
                          <p className="text-sm text-gray-500">Full return paid only at maturity</p>
                        </div>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="daily" id="daily" />
                      <Label htmlFor="daily" className="cursor-pointer">
                        <div>
                          <span className="font-medium">Daily Package</span>
                          <p className="text-sm text-gray-500">Daily income + capital return at maturity</p>
                        </div>
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                <Button onClick={handlePackageCreate} className="w-full">
                  Create Package
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Existing Packages</CardTitle>
                <CardDescription>Manage investment packages</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {packages.map((pkg) => (
                    <div key={pkg.id} className="p-4 border rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="font-semibold">{pkg.name}</h3>
                          <Badge variant="outline" className="mt-1">
                            {pkg.package_type === 'daily' ? 'Daily Income' : 'Stable Return'}
                          </Badge>
                        </div>
                        <Badge variant={pkg.is_active ? 'default' : 'secondary'}>
                          {pkg.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <div className="space-y-1 text-sm text-gray-600">
                        <p>Investment: {pkg.amount.toLocaleString()} RWF</p>
                        <p>Returns: {pkg.return_amount.toLocaleString()} RWF</p>
                        <p>Duration: {pkg.duration_days} days</p>
                        {pkg.package_type === 'daily' && pkg.daily_income && (
                          <p>Daily Income: {pkg.daily_income.toLocaleString()} RWF/day</p>
                        )}
                        <p>Max Purchases: {pkg.max_purchases}</p>
                      </div>
                      <div className="flex space-x-2 mt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handlePackageToggle(pkg.id, pkg.is_active)}
                        >
                          {pkg.is_active ? 'Deactivate' : 'Activate'}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handlePackageDelete(pkg.id, pkg.name)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Withdrawals Tab */}
        {activeTab === 'withdrawals' && (
          <Card>
            <CardHeader>
              <CardTitle>Withdrawal Requests</CardTitle>
              <CardDescription>Manage user withdrawal requests</CardDescription>
            </CardHeader>
            <CardContent>
              {withdrawals.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Fee</TableHead>
                      <TableHead>Net Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Requested</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {withdrawals.map((withdrawal) => (
                      <TableRow key={withdrawal.id}>
                        <TableCell>
                          {withdrawal.profiles.first_name} {withdrawal.profiles.last_name}
                        </TableCell>
                        <TableCell>{withdrawal.amount.toLocaleString()} RWF</TableCell>
                        <TableCell>{withdrawal.fee.toLocaleString()} RWF</TableCell>
                        <TableCell>{withdrawal.net_amount.toLocaleString()} RWF</TableCell>
                        <TableCell>
                          <Badge variant={
                            withdrawal.status === 'approved' ? 'default' :
                            withdrawal.status === 'rejected' ? 'destructive' : 'secondary'
                          }>
                            {withdrawal.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{new Date(withdrawal.requested_at).toLocaleDateString()}</TableCell>
                        <TableCell>
                          {withdrawal.status === 'pending' && (
                            <div className="flex space-x-2">
                              <Button
                                size="sm"
                                onClick={() => handleWithdrawalAction(withdrawal.id, 'approve')}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleWithdrawalAction(withdrawal.id, 'reject')}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <DollarSign className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No withdrawal requests found</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Wallet Adjustment Tab */}
        {activeTab === 'wallet' && (
          <Card>
            <CardHeader>
              <CardTitle>Wallet Management</CardTitle>
              <CardDescription>Manually adjust user wallet balances</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="userSelect">Select User</Label>
                  <select
                    id="userSelect"
                    className="w-full p-2 border rounded"
                    value={walletAdjustment.userId}
                    onChange={(e) => setWalletAdjustment({...walletAdjustment, userId: e.target.value})}
                  >
                    <option value="">Select a user</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.first_name} {user.last_name} ({user.wallet_balance.toLocaleString()} RWF)
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="adjustmentType">Type</Label>
                  <select
                    id="adjustmentType"
                    className="w-full p-2 border rounded"
                    value={walletAdjustment.type}
                    onChange={(e) => setWalletAdjustment({...walletAdjustment, type: e.target.value as 'add' | 'subtract'})}
                  >
                    <option value="add">Add Funds</option>
                    <option value="subtract">Subtract Funds</option>
                  </select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="adjustmentAmount">Amount (RWF)</Label>
                  <Input
                    id="adjustmentAmount"
                    type="number"
                    placeholder="Enter amount"
                    value={walletAdjustment.amount}
                    onChange={(e) => setWalletAdjustment({...walletAdjustment, amount: e.target.value})}
                  />
                </div>
                
                <div className="flex items-end">
                  <Button onClick={handleWalletAdjustment} className="w-full">
                    Adjust Wallet
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
