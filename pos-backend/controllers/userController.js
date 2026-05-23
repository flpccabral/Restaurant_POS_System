const createHttpError = require("http-errors");
const User = require("../models/userModel");
const Store = require("../models/storeModel");
const Role = require("../models/roleModel");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const config = require("../config/config");
const { registerDeviceOnLogin } = require("../middlewares/deviceApproval");

const register = async (req, res, next) => {
    try {
        const { name, phone, email, password, role, storeId, isMasterAdmin } = req.body;

        if(!name || !phone || !email || !password){
            const error = createHttpError(400, "Name, phone, email and password are required!");
            return next(error);
        }

        // Validar store (exceto para Master Admin)
        let store = null;
        if (!isMasterAdmin) {
            if (!storeId) {
                const error = createHttpError(400, "Store ID is required for non-admin users!");
                return next(error);
            }
            store = await Store.findOne({
                $or: [
                    { storeId },
                    { _id: storeId }
                ]
            });
            if (!store) {
                const error = createHttpError(400, "Invalid store ID!");
                return next(error);
            }
        }

        const isUserPresent = await User.findOne({email});
        if(isUserPresent){
            const error = createHttpError(400, "User already exist!");
            return next(error);
        }

        // Determinar role do usuário
        let userRole = null;

        if (isMasterAdmin) {
            // Master Admin usa role string 'Admin'
            userRole = 'Admin';
        } else if (role) {
            // Se role fornecido, pode ser nome ou ID
            if (typeof role === 'string') {
                // Tentar encontrar role por nome na loja
                userRole = await Role.findOne({
                    $or: [{ store }, { store: null }],  // Role da loja ou global
                    name: new RegExp(`^${role}$`, 'i')
                });
                if (!userRole) {
                    const error = createHttpError(400, `Role "${role}" not found!`);
                    return next(error);
                }
                userRole = userRole._id;
            } else {
                // Assume que é ObjectId
                userRole = role;
            }
        } else {
            // Role padrão: Garçom (ou primeira role disponível)
            userRole = await Role.findOne({
                $or: [{ store }, { store: null }],
                name: 'Garçom'
            });
            if (!userRole) {
                userRole = await Role.findOne({ store: null, name: 'Admin' });  // Fallback global
            }
        }

        const user = {
            name,
            phone,
            email,
            password,
            role: userRole || 'Garçom',  // Fallback string se nenhuma role encontrada
            store: store?._id,
            isMasterAdmin: isMasterAdmin || false,
            isActive: true
        };
        const newUser = await User.create(user);

        // Popular role para resposta
        const userWithRole = await User.findById(newUser._id).populate('role');

        res.status(201).json({success: true, message: "New user created!", data: userWithRole});


    } catch (error) {
        next(error);
    }
}


const login = async (req, res, next) => {

    try {

        const { email, password } = req.body;

        if(!email || !password) {
            const error = createHttpError(400, "All fields are required!");
            return next(error);
        }

        const isUserPresent = await User.findOne({email}).populate('store');
        if(!isUserPresent){
            const error = createHttpError(401, "Invalid Credentials");
            return next(error);
        }

        const isMatch = await bcrypt.compare(password, isUserPresent.password);
        if(!isMatch){
            const error = createHttpError(401, "Invalid Credentials");
            return next(error);
        }

        // Atualizar lastLoginAt
        isUserPresent.lastLoginAt = new Date();
        await isUserPresent.save();

        // Criar token com storeId incluso
        const accessToken = jwt.sign(
            {
                _id: isUserPresent._id,
                storeId: isUserPresent.store?._id,
                isMasterAdmin: isUserPresent.isMasterAdmin
            },
            config.accessTokenSecret,
            { expiresIn : '1d' }
        );

        res.cookie('accessToken', accessToken, {
            maxAge: 1000 * 60 * 60 *24 * 30,
            httpOnly: true,
            sameSite: config.nodeEnv === 'production' ? 'none' : 'lax',
            secure: config.nodeEnv === 'production'
        })

        // Registrar dispositivo
        req.user = isUserPresent;
        await registerDeviceOnLogin(req, res, async () => {});

        res.status(200).json({
            success: true,
            message: "User login successfully!",
            data: {
                ...isUserPresent.toObject(),
                device: req.device
            }
        });


    } catch (error) {
        next(error);
    }

}

const getUserData = async (req, res, next) => {
    try {

        const user = await User.findById(req.user._id)
            .populate('store')
            .populate('role');
        res.status(200).json({success: true, data: user});

    } catch (error) {
        next(error);
    }
}

const logout = async (req, res, next) => {
    try {
        
        res.clearCookie('accessToken');
        res.status(200).json({success: true, message: "User logout successfully!"});

    } catch (error) {
        next(error);
    }
}




module.exports = { register, login, getUserData, logout }